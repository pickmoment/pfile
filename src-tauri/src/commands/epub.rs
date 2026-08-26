use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;
use zip::ZipArchive;

// ── Types ───────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EpubTocEntry {
    pub title: String,
    pub href: String,
    pub level: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EpubChapter {
    pub id: String,
    pub href: String,
    pub title: String,
    /// Chapter HTML with images inlined as base64 data URIs
    pub html: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EpubMetadata {
    pub title: String,
    pub author: String,
    pub language: String,
    pub description: String,
    pub toc: Vec<EpubTocEntry>,
    pub chapter_count: usize,
    pub cover_base64: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EpubContent {
    pub metadata: EpubMetadata,
    pub chapters: Vec<EpubChapter>,
    pub css: String,
}

// ── OPF Parsing (simple XML extraction — no full XML parser dep) ─

fn extract_tag_content(xml: &str, tag: &str) -> Option<String> {
    let open = format!("<{}", tag);
    let start = xml.find(&open)?;
    let after_open = &xml[start..];
    let content_start = after_open.find('>')? + 1;
    let close = format!("</{}", tag);
    let end = after_open.find(&close)?;
    Some(after_open[content_start..end].trim().to_string())
}

fn extract_attr(tag_str: &str, attr: &str) -> Option<String> {
    let needle = format!("{}=\"", attr);
    let start = tag_str.find(&needle)? + needle.len();
    let end = tag_str[start..].find('"')? + start;
    Some(tag_str[start..end].to_string())
}

struct ManifestItem {
    id: String,
    href: String,
    media_type: String,
}

fn parse_opf(opf_xml: &str) -> (Vec<ManifestItem>, Vec<String>, String, String, String, String, Option<String>) {
    let mut manifest = Vec::new();
    let mut spine_ids = Vec::new();
    let mut title = String::new();
    let mut author = String::new();
    let mut language = String::new();
    let mut description = String::new();
    let mut cover_id: Option<String> = None;

    // Metadata
    if let Some(t) = extract_tag_content(opf_xml, "dc:title") {
        title = t;
    }
    if let Some(a) = extract_tag_content(opf_xml, "dc:creator") {
        author = a;
    }
    if let Some(l) = extract_tag_content(opf_xml, "dc:language") {
        language = l;
    }
    if let Some(d) = extract_tag_content(opf_xml, "dc:description") {
        description = html_entities_decode(&d);
    }

    // Find cover meta
    for line in opf_xml.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("<meta") && trimmed.contains("name=\"cover\"") {
            if let Some(id) = extract_attr(trimmed, "content") {
                cover_id = Some(id);
            }
        }
    }

    // Manifest items
    for line in opf_xml.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("<item") {
            if let (Some(id), Some(href), Some(mt)) = (
                extract_attr(trimmed, "id"),
                extract_attr(trimmed, "href"),
                extract_attr(trimmed, "media-type"),
            ) {
                manifest.push(ManifestItem {
                    id,
                    href,
                    media_type: mt,
                });
            }
        }
    }

    // Spine
    for line in opf_xml.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("<itemref") {
            if let Some(idref) = extract_attr(trimmed, "idref") {
                spine_ids.push(idref);
            }
        }
    }

    (manifest, spine_ids, title, author, language, description, cover_id)
}

fn html_entities_decode(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
}

// ── NAV / NCX TOC Parsing ───────────────────────────────────────

fn parse_ncx_toc(ncx_xml: &str) -> Vec<EpubTocEntry> {
    let mut toc = Vec::new();
    let mut i = 0;
    let bytes = ncx_xml.as_bytes();

    while i < bytes.len() {
        // Find <navPoint
        if let Some(pos) = ncx_xml[i..].find("<navPoint") {
            let abs = i + pos;
            // Find <text>...</text>
            if let Some(text_start) = ncx_xml[abs..].find("<text>") {
                let t_start = abs + text_start + 6;
                if let Some(t_end) = ncx_xml[t_start..].find("</text>") {
                    let title = ncx_xml[t_start..t_start + t_end].trim().to_string();
                    // Find <content src="..."/>
                    if let Some(content_pos) = ncx_xml[abs..].find("<content") {
                        let content_tag = &ncx_xml[abs + content_pos..];
                        if let Some(href) = extract_attr(content_tag, "src") {
                            toc.push(EpubTocEntry {
                                title: html_entities_decode(&title),
                                href,
                                level: 1,
                            });
                        }
                    }
                    i = t_start + t_end;
                    continue;
                }
            }
            i = abs + 9;
        } else {
            break;
        }
    }

    toc
}

fn parse_nav_toc(nav_html: &str) -> Vec<EpubTocEntry> {
    let mut toc = Vec::new();
    // Simple: find all <a href="...">text</a> inside <nav>
    let nav_section = if let Some(start) = nav_html.find("<nav") {
        if let Some(end) = nav_html[start..].find("</nav>") {
            &nav_html[start..start + end]
        } else {
            nav_html
        }
    } else {
        nav_html
    };

    let mut search_from = 0;
    while let Some(a_pos) = nav_section[search_from..].find("<a") {
        let abs = search_from + a_pos;
        let tag_end = match nav_section[abs..].find('>') {
            Some(p) => abs + p,
            None => break,
        };
        let href = extract_attr(&nav_section[abs..tag_end + 1], "href").unwrap_or_default();
        let close = match nav_section[tag_end..].find("</a>") {
            Some(p) => tag_end + p,
            None => break,
        };
        let text = strip_html_tags(&nav_section[tag_end + 1..close]).trim().to_string();
        if !text.is_empty() {
            toc.push(EpubTocEntry {
                title: html_entities_decode(&text),
                href,
                level: 1,
            });
        }
        search_from = close + 4;
    }

    toc
}

fn strip_html_tags(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut in_tag = false;
    for ch in s.chars() {
        if ch == '<' {
            in_tag = true;
        } else if ch == '>' {
            in_tag = false;
        } else if !in_tag {
            out.push(ch);
        }
    }
    out
}

// ── Image inlining ──────────────────────────────────────────────

fn inline_images(
    html: &str,
    chapter_dir: &str,
    resources: &HashMap<String, (String, Vec<u8>)>, // normalized_path → (media_type, data)
) -> String {
    let mut result = html.to_string();

    // Replace src="..." with data URIs
    let patterns = ["src=\"", "src='"];
    for pattern in &patterns {
        let mut output = String::with_capacity(result.len());
        let mut remaining = result.as_str();

        while let Some(pos) = remaining.find(pattern) {
            output.push_str(&remaining[..pos + pattern.len()]);
            remaining = &remaining[pos + pattern.len()..];

            let quote = if *pattern == "src=\"" { '"' } else { '\'' };
            if let Some(end) = remaining.find(quote) {
                let src = &remaining[..end];
                // Resolve relative path
                let resolved = resolve_path(chapter_dir, src);
                if let Some((mt, data)) = resources.get(&resolved) {
                    let b64 = BASE64.encode(data);
                    output.push_str(&format!("data:{};base64,{}", mt, b64));
                } else {
                    output.push_str(src);
                }
                remaining = &remaining[end..];
            }
        }
        output.push_str(remaining);
        result = output;
    }

    result
}

fn resolve_path(base_dir: &str, relative: &str) -> String {
    if relative.starts_with("data:") || relative.starts_with("http") {
        return relative.to_string();
    }
    let relative = relative.split('#').next().unwrap_or(relative);
    let relative = relative.split('?').next().unwrap_or(relative);

    let mut parts: Vec<&str> = if base_dir.is_empty() {
        Vec::new()
    } else {
        base_dir.split('/').filter(|s| !s.is_empty()).collect()
    };

    for seg in relative.split('/') {
        match seg {
            ".." => { parts.pop(); }
            "." | "" => {}
            s => parts.push(s),
        }
    }

    parts.join("/")
}

// ── Main Command ────────────────────────────────────────────────

#[tauri::command]
pub fn epub_read(path: String) -> Result<EpubContent, String> {
    let p = Path::new(&path);
    let file = File::open(p).map_err(|e| format!("Failed to open: {}", e))?;
    let reader = BufReader::new(file);
    let mut archive = ZipArchive::new(reader).map_err(|e| format!("Invalid EPUB (not a valid ZIP): {}", e))?;

    // 1. Read container.xml to find OPF path
    let container_xml = read_zip_text(&mut archive, "META-INF/container.xml")?;
    let opf_path = extract_attr(&container_xml, "full-path")
        .ok_or("Cannot find rootfile in container.xml")?;
    let opf_dir = opf_path.rsplit_once('/').map(|(d, _)| d.to_string()).unwrap_or_default();

    // 2. Read & parse OPF
    let opf_xml = read_zip_text(&mut archive, &opf_path)?;
    let (manifest, spine_ids, title, author, language, description, cover_id) = parse_opf(&opf_xml);

    // 3. Build resource map (images, CSS, etc.)
    let mut resources: HashMap<String, (String, Vec<u8>)> = HashMap::new();
    let mut css_parts: Vec<String> = Vec::new();
    let mut toc_href: Option<String> = None;
    let mut ncx_href: Option<String> = None;
    let mut cover_href: Option<String> = None;

    for item in &manifest {
        let full_href = if opf_dir.is_empty() {
            item.href.clone()
        } else {
            format!("{}/{}", opf_dir, item.href)
        };

        if item.media_type.starts_with("image/") {
            if let Ok(data) = read_zip_bytes(&mut archive, &full_href) {
                resources.insert(
                    resolve_path(&opf_dir, &item.href),
                    (item.media_type.clone(), data),
                );
            }
        }

        if item.media_type == "text/css" || item.href.ends_with(".css") {
            if let Ok(css) = read_zip_text(&mut archive, &full_href) {
                css_parts.push(css);
            }
        }

        if item.media_type == "application/x-dtbncx+xml" {
            ncx_href = Some(full_href.clone());
        }

        if item.media_type == "application/xhtml+xml"
            && (item.id.contains("nav") || item.href.contains("nav"))
        {
            toc_href = Some(full_href.clone());
        }

        if Some(&item.id) == cover_id.as_ref() && item.media_type.starts_with("image/") {
            cover_href = Some(full_href.clone());
        }
    }

    // 4. Parse TOC
    let toc = if let Some(ref nav_path) = toc_href {
        read_zip_text(&mut archive, nav_path)
            .map(|html| parse_nav_toc(&html))
            .unwrap_or_default()
    } else if let Some(ref ncx_path) = ncx_href {
        read_zip_text(&mut archive, ncx_path)
            .map(|xml| parse_ncx_toc(&xml))
            .unwrap_or_default()
    } else {
        Vec::new()
    };

    // 5. Cover image
    let cover_base64 = cover_href.and_then(|href| {
        resources.get(&resolve_path(&opf_dir, &href.replace(&format!("{}/", opf_dir), "")))
            .map(|(mt, data)| format!("data:{};base64,{}", mt, BASE64.encode(data)))
            .or_else(|| {
                read_zip_bytes(&mut archive, &href).ok().map(|data| {
                    let mt = if href.ends_with(".png") { "image/png" }
                    else if href.ends_with(".gif") { "image/gif" }
                    else { "image/jpeg" };
                    format!("data:{};base64,{}", mt, BASE64.encode(&data))
                })
            })
    });

    // 6. Build chapters from spine
    let id_to_item: HashMap<&str, &ManifestItem> =
        manifest.iter().map(|m| (m.id.as_str(), m)).collect();

    let mut chapters = Vec::new();
    for spine_id in &spine_ids {
        let item = match id_to_item.get(spine_id.as_str()) {
            Some(i) => i,
            None => continue,
        };

        let full_href = if opf_dir.is_empty() {
            item.href.clone()
        } else {
            format!("{}/{}", opf_dir, item.href)
        };

        let chapter_dir = full_href.rsplit_once('/').map(|(d, _)| d.to_string()).unwrap_or_default();

        let raw_html = match read_zip_text(&mut archive, &full_href) {
            Ok(h) => h,
            Err(_) => continue,
        };

        // Inline images
        let html = inline_images(&raw_html, &chapter_dir, &resources);

        // Try to extract <title> as chapter title
        let ch_title = extract_tag_content(&html, "title")
            .or_else(|| {
                // Try first <h1>, <h2>, <h3>
                for tag in &["h1", "h2", "h3"] {
                    if let Some(t) = extract_tag_content(&html, tag) {
                        return Some(strip_html_tags(&t));
                    }
                }
                None
            })
            .unwrap_or_else(|| item.href.clone());

        // Extract body content only
        let body_html = extract_body(&html);

        chapters.push(EpubChapter {
            id: item.id.clone(),
            href: item.href.clone(),
            title: ch_title,
            html: body_html,
        });
    }

    // Match TOC titles to chapters if TOC had titles
    if !toc.is_empty() && chapters.len() >= toc.len() {
        for toc_entry in &toc {
            let href_base = toc_entry.href.split('#').next().unwrap_or(&toc_entry.href);
            for ch in &mut chapters {
                if ch.href == href_base || ch.href.ends_with(href_base) {
                    if ch.title == ch.href || ch.title.is_empty() {
                        ch.title = toc_entry.title.clone();
                    }
                }
            }
        }
    }

    let chapter_count = chapters.len();

    Ok(EpubContent {
        metadata: EpubMetadata {
            title,
            author,
            language,
            description,
            toc,
            chapter_count,
            cover_base64,
        },
        chapters,
        css: css_parts.join("\n\n"),
    })
}

// ── ZIP helpers ─────────────────────────────────────────────────

fn read_zip_text(archive: &mut ZipArchive<BufReader<File>>, name: &str) -> Result<String, String> {
    let mut entry = archive.by_name(name).map_err(|e| format!("{}: {}", name, e))?;
    let mut buf = String::new();
    entry.read_to_string(&mut buf).map_err(|e| e.to_string())?;
    Ok(buf)
}

fn read_zip_bytes(archive: &mut ZipArchive<BufReader<File>>, name: &str) -> Result<Vec<u8>, String> {
    let mut entry = archive.by_name(name).map_err(|e| format!("{}: {}", name, e))?;
    let mut buf = Vec::with_capacity(entry.size() as usize);
    entry.read_to_end(&mut buf).map_err(|e| e.to_string())?;
    Ok(buf)
}

fn extract_body(html: &str) -> String {
    // Extract content between <body...> and </body>
    let lower = html.to_lowercase();
    let body_start = lower.find("<body");
    let body_end = lower.find("</body>");

    if let (Some(start), Some(end)) = (body_start, body_end) {
        let content_start = html[start..].find('>').map(|p| start + p + 1).unwrap_or(start);
        html[content_start..end].to_string()
    } else {
        html.to_string()
    }
}
