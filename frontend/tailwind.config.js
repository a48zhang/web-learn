/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0f141b',
        surface: '#151b23',
        'surface-2': '#1b222c',
        'surface-3': '#232d38',
        border: '#2d3947',
        primary: '#7db8ff',
        'primary-strong': '#58a6ff',
        secondary: '#c7b3ff',
        accent: '#ffba42',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
        display: ['Space Grotesk', 'Inter', 'ui-sans-serif'],
      },
      boxShadow: {
        panel: '0 18px 60px rgba(0, 0, 0, 0.28)',
      },
      borderRadius: {
        panel: '20px',
      },
    },
  },
  plugins: [],
};
