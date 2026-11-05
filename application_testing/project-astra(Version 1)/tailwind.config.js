/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0c0d0f',
        panel: '#141619',
        panel2: '#1a1d21',
        line: '#272b31',
        ink: '#e7e4df',
        mute: '#8c929a',
        rust: { DEFAULT: '#d9632b', dim: '#8f3f1b', soft: '#f08a55' },
        obs: '#5fb3a1',
        der: '#d6a84a',
        mod: '#8e8bd8',
        sim: '#e06c5a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
