/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // warm editorial palette
        ink: {
          DEFAULT: '#1A1410',
          900: '#1A1410',
          700: '#3D332B',
          500: '#6B5D54',
          400: '#8B7B6E',
          300: '#B5A89B',
        },
        paper: {
          DEFAULT: '#F4ECDF',
          dark: '#EBE0CC',
          light: '#FAF4E8',
        },
        surface: '#FFFCF5',
        hairline: '#E0D3BC',
        terracotta: {
          DEFAULT: '#C44A2C',
          dark: '#9F3A21',
          light: '#E89B85',
          50: '#F8E5DD',
        },
        sage: {
          DEFAULT: '#7A8F6F',
          dark: '#5D7253',
          light: '#B5C5A8',
          50: '#E6EBDF',
        },
        plum: {
          DEFAULT: '#5D4A5C',
          light: '#9B8A9A',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['"Fraunces"', '"Cormorant Garamond"', 'ui-serif', 'Georgia', 'serif'],
      },
      letterSpacing: {
        tightest: '-0.03em',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(26, 20, 16, 0.04)',
        card: '0 8px 24px -8px rgba(26, 20, 16, 0.08), 0 2px 4px -1px rgba(26, 20, 16, 0.04)',
        cta: '0 8px 24px -8px rgba(196, 74, 44, 0.45), 0 2px 4px rgba(196, 74, 44, 0.18)',
        'cta-hover': '0 12px 32px -10px rgba(196, 74, 44, 0.55), 0 4px 8px rgba(196, 74, 44, 0.25)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        smooth: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      backgroundImage: {
        'paper-glow':
          'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(196, 74, 44, 0.10) 0%, rgba(196, 74, 44, 0.02) 40%, transparent 70%)',
        'paper-gradient':
          'linear-gradient(180deg, #FAF4E8 0%, #F4ECDF 100%)',
      },
    },
  },
  plugins: [],
};
