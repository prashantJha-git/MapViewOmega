/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glow-emerald': '0 0 0 1px rgba(16,185,129,0.15), 0 8px 30px -8px rgba(16,185,129,0.35)',
        'glow-blue': '0 0 0 1px rgba(59,130,246,0.15), 0 8px 30px -8px rgba(59,130,246,0.35)',
        'glow-rose': '0 0 0 1px rgba(244,63,94,0.15), 0 8px 30px -8px rgba(244,63,94,0.35)',
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 10px 30px -12px rgba(0,0,0,0.55)',
      },
      backgroundImage: {
        'grid-faint':
          'linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '32px 32px',
      },
    },
  },
  plugins: [],
};
