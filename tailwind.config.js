/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
        body: ['var(--font-body)'],
      },
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        border: 'var(--border)',
        accent: 'var(--accent)',
        'accent-dim': 'var(--accent-dim)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        danger: 'var(--danger)',
        success: 'var(--success)',
      },
    },
  },
  plugins: [],
};
