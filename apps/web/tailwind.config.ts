import type { Config } from 'tailwindcss';

/**
 * LEI design tokens.
 *
 * Two families only — a near-black industrial navy and a single amber accent —
 * taken from the approved homepage design. Constraining the palette here means
 * components cannot quietly introduce a fourth blue.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#12161c',
          soft: '#1c2430',
          muted: '#5b6672',
          line: '#e3e6ea',
          wash: '#f6f7f9',
        },
        amber: {
          DEFAULT: '#f5b301',
          dark: '#d99a00',
          wash: '#fff8e3',
        },
        ok: '#1d7a4a',
        warn: '#a8730b',
        bad: '#b4331f',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      maxWidth: { container: '1280px' },
      borderRadius: { card: '10px' },
    },
  },
  plugins: [],
};

export default config;
