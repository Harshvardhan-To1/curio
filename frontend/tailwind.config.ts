import type { Config } from 'tailwindcss';

/**
 * "Quiet Slate" - dark-first, developer-leaning palette.
 *   bg #16181D · surface #23262E · text #ECEEF1 · muted #9AA1AC · accent #FF7849
 * `brand` is the orange accent (kept as the name many components already use).
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#16181D',
        surface: '#23262E',
        elevated: '#2b2f38',
        line: '#30343d',
        fg: '#ECEEF1',
        muted: '#9AA1AC',
        brand: {
          DEFAULT: '#FF7849',
          muted: '#ff8c63',
          fg: '#16181D',
        },
        accent: '#FF7849',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
