use serde::{Deserialize, Serialize};
use tiktoken_rs::cl100k_base_singleton;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct TokenStats {
    pub token_count: usize,
    pub word_count: usize,
    pub line_count: usize,
    pub char_count: usize,
}

const MAX_DIRECT_TOKEN_CHARS: usize = 120_000; // ~30k tokens max for single-pass BPE calculation

pub fn compute_stats_for_text(text: &str) -> TokenStats {
    let char_count = text.chars().count();
    if char_count == 0 {
        return TokenStats {
            token_count: 0,
            word_count: 0,
            line_count: 0,
            char_count: 0,
        };
    }

    let line_count = text.lines().count().max(1);
    let word_count = text.split_whitespace().count();

    // Fast BPE tokenization using cl100k_base with scale safety for huge files
    let token_count = if char_count <= MAX_DIRECT_TOKEN_CHARS {
        let bpe = cl100k_base_singleton();
        let bpe_guard = bpe.lock();
        bpe_guard.encode_with_special_tokens(text).len()
    } else {
        // Sample first 100k characters to extrapolate token density safely without freezing CPU
        let sample = &text[..text
            .char_indices()
            .nth(MAX_DIRECT_TOKEN_CHARS)
            .map(|(i, _)| i)
            .unwrap_or(text.len())];
        let sample_tokens = {
            let bpe = cl100k_base_singleton();
            let bpe_guard = bpe.lock();
            bpe_guard.encode_with_special_tokens(sample).len()
        };
        let ratio = sample_tokens as f64 / sample.len() as f64;
        (text.len() as f64 * ratio) as usize
    };

    TokenStats {
        token_count,
        word_count,
        line_count,
        char_count,
    }
}

#[tauri::command]
pub fn calculate_tokens(text: String) -> Result<TokenStats, String> {
    Ok(compute_stats_for_text(&text))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_stats() {
        let sample =
            "Hello, world! This is a test for pfile token counting.\nLine 2 with some words.";
        let stats = compute_stats_for_text(sample);
        assert_eq!(stats.line_count, 2);
        assert_eq!(stats.word_count, 15);
        assert!(stats.char_count > 50);
        assert!(stats.token_count >= 14);
    }

    #[test]
    fn test_empty_string() {
        let stats = compute_stats_for_text("");
        assert_eq!(stats.token_count, 0);
        assert_eq!(stats.word_count, 0);
        assert_eq!(stats.line_count, 0);
        assert_eq!(stats.char_count, 0);
    }
}
