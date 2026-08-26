/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        sidebar: {
          DEFAULT: "var(--sidebar-bg)",
          foreground: "var(--sidebar-fg)",
          border: "var(--sidebar-border)",
          accent: "var(--sidebar-accent)",
          hover: "var(--sidebar-hover)",
        },
        panel: {
          DEFAULT: "var(--panel-bg)",
          border: "var(--panel-border)",
        },
      },
      fontFamily: {
        mono: ['"Fira Code"', '"Cascadia Code"', '"JetBrains Mono"', 'Consolas', 'monospace'],
        sans: ['"Pretendard"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
