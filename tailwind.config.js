/** NOIR Interface System (NIS) — design tokens. Strictly monochrome. */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        noir: {
          black: '#080808', // main background
          obsidian: '#111111', // secondary background
          charcoal: '#191919', // cards / panels
          graphite: '#242424', // elevated surfaces
          line: '#303030', // borders
          ash: '#5c5c5c', // disabled / tertiary
          silver: '#888888', // muted text
          mist: '#b5b5b5', // secondary text
          paper: '#f2f2f2', // primary text
          white: '#ffffff', // highlight
        },
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', '"Segoe UI Variable"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'Consolas', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '14px',
        ctl: '10px',
      },
      boxShadow: {
        card: 'inset 0 1px 0 0 rgba(255,255,255,0.03), 0 10px 24px -14px rgba(0,0,0,0.7)',
        float: '0 16px 40px -10px rgba(0,0,0,0.8), 0 0 0 1px #303030',
      },
      transitionDuration: {
        fast: '120ms',
        base: '180ms',
        slow: '240ms',
      },
      transitionTimingFunction: {
        noir: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
