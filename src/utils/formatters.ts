export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const idx = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, idx)).toFixed(dm))} ${sizes[idx]}`;
}

export function formatDate(ms: number): string {
  if (!ms || ms === 0) return '-';
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function formatRelativeTime(ms: number): string {
  if (!ms || ms === 0) return '';
  const now = Date.now();
  const diffSec = Math.floor((now - ms) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return formatDate(ms);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat().format(n);
}

export function getLanguageFromPath(path: string): string {
  const parts = path.toLowerCase().split('.');
  const ext = parts.length > 1 ? parts[parts.length - 1] : '';

  const extMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    rs: 'rust',
    py: 'python',
    json: 'json',
    jsonc: 'json',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'scss',
    less: 'less',
    md: 'markdown',
    markdown: 'markdown',
    mdx: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'ini',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    bat: 'bat',
    ps1: 'powershell',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    go: 'go',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    rb: 'ruby',
    php: 'php',
    lua: 'lua',
    zig: 'zig',
    xml: 'xml',
    svg: 'xml',
    dockerfile: 'dockerfile',
    ini: 'ini',
    env: 'ini',
  };

  return extMap[ext] || 'plaintext';
}
