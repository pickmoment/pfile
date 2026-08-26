use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{self, BufReader, Read};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ArchiveEntry {
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub compressed_size: Option<u64>,
    pub modified_ms: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ArchiveInfo {
    pub format: String,
    pub total_entries: usize,
    pub total_size: u64,
    pub compressed_size: u64,
    pub entries: Vec<ArchiveEntry>,
}

// ── Zip ─────────────────────────────────────────────────────────

fn read_zip(path: &Path) -> Result<ArchiveInfo, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open: {}", e))?;
    let reader = BufReader::new(file);
    let mut archive = zip::ZipArchive::new(reader).map_err(|e| format!("Invalid zip: {}", e))?;

    let mut entries = Vec::with_capacity(archive.len());
    let mut total_size = 0u64;
    let mut compressed_size = 0u64;

    for i in 0..archive.len() {
        let entry = archive.by_index_raw(i).map_err(|e| e.to_string())?;
        let name = entry.name().to_string();
        let is_dir = name.ends_with('/');
        let size = entry.size();
        let comp = entry.compressed_size();
        let modified_ms = entry.last_modified().and_then(|dt| {
            let file_dt = chrono::NaiveDate::from_ymd_opt(
                dt.year() as i32,
                dt.month() as u32,
                dt.day() as u32,
            )?
            .and_hms_opt(dt.hour() as u32, dt.minute() as u32, dt.second() as u32)?;
            let epoch = chrono::NaiveDate::from_ymd_opt(1970, 1, 1)?
                .and_hms_opt(0, 0, 0)?;
            Some(((file_dt - epoch).num_milliseconds()).max(0) as u64)
        });

        total_size += size;
        compressed_size += comp;

        entries.push(ArchiveEntry {
            path: name,
            is_dir,
            size,
            compressed_size: Some(comp),
            modified_ms,
        });
    }

    Ok(ArchiveInfo {
        format: "zip".to_string(),
        total_entries: entries.len(),
        total_size,
        compressed_size,
        entries,
    })
}

// ── Tar (plain, gz, bz2, xz) ───────────────────────────────────

fn read_tar_entries<R: Read>(reader: R) -> Result<(Vec<ArchiveEntry>, u64), String> {
    let mut archive = tar::Archive::new(reader);
    let mut entries = Vec::new();
    let mut total_size = 0u64;

    for entry_result in archive.entries().map_err(|e| e.to_string())? {
        let entry = entry_result.map_err(|e| e.to_string())?;
        let header = entry.header();
        let path = entry
            .path()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        let is_dir = header.entry_type().is_dir();
        let size = header.size().unwrap_or(0);
        let modified_ms = header.mtime().ok().map(|t| t * 1000);

        total_size += size;

        entries.push(ArchiveEntry {
            path,
            is_dir,
            size,
            compressed_size: None,
            modified_ms,
        });
    }

    Ok((entries, total_size))
}

fn read_tar(path: &Path) -> Result<ArchiveInfo, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open: {}", e))?;
    let file_size = file.metadata().map(|m| m.len()).unwrap_or(0);
    let reader = BufReader::new(file);
    let (entries, total_size) = read_tar_entries(reader)?;

    Ok(ArchiveInfo {
        format: "tar".to_string(),
        total_entries: entries.len(),
        total_size,
        compressed_size: file_size,
        entries,
    })
}

fn read_tar_gz(path: &Path) -> Result<ArchiveInfo, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open: {}", e))?;
    let file_size = file.metadata().map(|m| m.len()).unwrap_or(0);
    let reader = BufReader::new(file);
    let decoder = flate2::read::GzDecoder::new(reader);
    let (entries, total_size) = read_tar_entries(decoder)?;

    Ok(ArchiveInfo {
        format: "tar.gz".to_string(),
        total_entries: entries.len(),
        total_size,
        compressed_size: file_size,
        entries,
    })
}

fn read_tar_bz2(path: &Path) -> Result<ArchiveInfo, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open: {}", e))?;
    let file_size = file.metadata().map(|m| m.len()).unwrap_or(0);
    let reader = BufReader::new(file);
    let decoder = bzip2::read::BzDecoder::new(reader);
    let (entries, total_size) = read_tar_entries(decoder)?;

    Ok(ArchiveInfo {
        format: "tar.bz2".to_string(),
        total_entries: entries.len(),
        total_size,
        compressed_size: file_size,
        entries,
    })
}

fn read_tar_xz(path: &Path) -> Result<ArchiveInfo, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open: {}", e))?;
    let file_size = file.metadata().map(|m| m.len()).unwrap_or(0);
    let reader = BufReader::new(file);
    let decoder = xz2::read::XzDecoder::new(reader);
    let (entries, total_size) = read_tar_entries(decoder)?;

    Ok(ArchiveInfo {
        format: "tar.xz".to_string(),
        total_entries: entries.len(),
        total_size,
        compressed_size: file_size,
        entries,
    })
}

// ── Detect format and dispatch ──────────────────────────────────

fn detect_format(path: &Path) -> &'static str {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    if name.ends_with(".tar.gz") || name.ends_with(".tgz") {
        "tar.gz"
    } else if name.ends_with(".tar.bz2") || name.ends_with(".tbz2") {
        "tar.bz2"
    } else if name.ends_with(".tar.xz") || name.ends_with(".txz") {
        "tar.xz"
    } else {
        match path.extension().and_then(|e| e.to_str()) {
            Some(e) => match e.to_lowercase().as_str() {
                "zip" | "jar" | "war" | "ear" | "apk" | "ipa" | "whl" | "egg" => "zip",
                "tar" => "tar",
                "gz" => "gz",
                "bz2" => "bz2",
                "xz" => "xz",
                _ => "unknown",
            },
            None => "unknown",
        }
    }
}

// ── Commands ────────────────────────────────────────────────────

#[tauri::command]
pub fn archive_list(path: String) -> Result<ArchiveInfo, String> {
    let p = Path::new(&path);
    match detect_format(p) {
        "zip" => read_zip(p),
        "tar" => read_tar(p),
        "tar.gz" | "gz" => read_tar_gz(p),
        "tar.bz2" | "bz2" => read_tar_bz2(p),
        "tar.xz" | "xz" => read_tar_xz(p),
        fmt => Err(format!("Unsupported archive format: {}", fmt)),
    }
}

#[tauri::command]
pub fn archive_extract_file(
    archive_path: String,
    entry_path: String,
) -> Result<String, String> {
    let p = Path::new(&archive_path);
    let fmt = detect_format(p);

    match fmt {
        "zip" => extract_zip_file(p, &entry_path),
        "tar" | "tar.gz" | "gz" | "tar.bz2" | "bz2" | "tar.xz" | "xz" => {
            extract_tar_file(p, fmt, &entry_path)
        }
        _ => Err(format!("Unsupported format: {}", fmt)),
    }
}

fn extract_zip_file(path: &Path, entry_path: &str) -> Result<String, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let mut archive = zip::ZipArchive::new(reader).map_err(|e| e.to_string())?;

    let mut entry = archive.by_name(entry_path).map_err(|e| e.to_string())?;
    let size = entry.size();

    // Limit to 2MB for preview
    if size > 2 * 1024 * 1024 {
        return Err("File too large for preview (>2MB)".to_string());
    }

    let mut buf = Vec::with_capacity(size as usize);
    entry.read_to_end(&mut buf).map_err(|e| e.to_string())?;

    // Try as UTF-8, fall back to base64
    match String::from_utf8(buf.clone()) {
        Ok(text) => Ok(text),
        Err(_) => {
            use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
            Ok(format!("base64:{}", BASE64.encode(&buf)))
        }
    }
}

fn extract_tar_file(path: &Path, fmt: &str, entry_path: &str) -> Result<String, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);

    let result: Result<String, String> = match fmt {
        "tar" => extract_from_tar(reader, entry_path),
        "tar.gz" | "gz" => extract_from_tar(flate2::read::GzDecoder::new(reader), entry_path),
        "tar.bz2" | "bz2" => extract_from_tar(bzip2::read::BzDecoder::new(reader), entry_path),
        "tar.xz" | "xz" => extract_from_tar(xz2::read::XzDecoder::new(reader), entry_path),
        _ => Err("Unsupported".to_string()),
    };

    result
}

fn extract_from_tar<R: Read>(reader: R, entry_path: &str) -> Result<String, String> {
    let mut archive = tar::Archive::new(reader);

    for entry_result in archive.entries().map_err(|e| e.to_string())? {
        let mut entry = entry_result.map_err(|e| e.to_string())?;
        let path = entry
            .path()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        if path == entry_path {
            let size = entry.size();
            if size > 2 * 1024 * 1024 {
                return Err("File too large for preview (>2MB)".to_string());
            }
            let mut buf = Vec::with_capacity(size as usize);
            entry.read_to_end(&mut buf).map_err(|e| e.to_string())?;

            return match String::from_utf8(buf.clone()) {
                Ok(text) => Ok(text),
                Err(_) => {
                    use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
                    Ok(format!("base64:{}", BASE64.encode(&buf)))
                }
            };
        }
    }

    Err(format!("Entry not found: {}", entry_path))
}

#[tauri::command]
pub fn archive_extract_to(
    archive_path: String,
    dest_dir: String,
) -> Result<u32, String> {
    let p = Path::new(&archive_path);
    let dest = Path::new(&dest_dir);

    if !dest.exists() {
        std::fs::create_dir_all(dest).map_err(|e| e.to_string())?;
    }

    let fmt = detect_format(p);

    match fmt {
        "zip" => extract_zip_all(p, dest),
        "tar" | "tar.gz" | "gz" | "tar.bz2" | "bz2" | "tar.xz" | "xz" => {
            extract_tar_all(p, fmt, dest)
        }
        _ => Err(format!("Unsupported format: {}", fmt)),
    }
}

fn extract_zip_all(path: &Path, dest: &Path) -> Result<u32, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let mut archive = zip::ZipArchive::new(reader).map_err(|e| e.to_string())?;
    let mut count = 0u32;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let out_path = dest.join(entry.mangled_name());

        if entry.is_dir() {
            std::fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut out_file = File::create(&out_path).map_err(|e| e.to_string())?;
            io::copy(&mut entry, &mut out_file).map_err(|e| e.to_string())?;
            count += 1;
        }
    }

    Ok(count)
}

fn extract_tar_all(path: &Path, fmt: &str, dest: &Path) -> Result<u32, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);

    match fmt {
        "tar" => unpack_tar(reader, dest),
        "tar.gz" | "gz" => unpack_tar(flate2::read::GzDecoder::new(reader), dest),
        "tar.bz2" | "bz2" => unpack_tar(bzip2::read::BzDecoder::new(reader), dest),
        "tar.xz" | "xz" => unpack_tar(xz2::read::XzDecoder::new(reader), dest),
        _ => Err("Unsupported".to_string()),
    }
}

fn unpack_tar<R: Read>(reader: R, dest: &Path) -> Result<u32, String> {
    let mut archive = tar::Archive::new(reader);
    archive.unpack(dest).map_err(|e| e.to_string())?;
    // Count files extracted (approximate from walk)
    let count = walkdir::WalkDir::new(dest)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .count();
    Ok(count as u32)
}
