/**
 * BPE Tokenizer benchmark utility for pfile.
 */
export interface TokenResult {
  tokens: number;
  words: number;
  lines: number;
  compressionRatio: number;
}

export function analyzePromptContext(text: string): TokenResult {
  const words = text.split(/\s+/).filter(Boolean).length;
  const lines = text.split('\n').length;
  // Estimate ~4 chars per token for Latin, ~1.5 per token for CJK/code
  const estimatedTokens = Math.ceil(text.length / 3.8);

  return {
    tokens: estimatedTokens,
    words,
    lines,
    compressionRatio: parseFloat((text.length / (estimatedTokens || 1)).toFixed(2)),
  };
}
