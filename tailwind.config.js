/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        forge: {
          background: '#0F1115',
          surface: '#171A21',
          card: '#1E222B',
          border: '#2A2F3A',
          primary: '#E6E8EE',
          secondary: '#A0A6B2',
          muted: '#6B7280',
          pink: '#F15FA5',
          violet: '#8B6CFF',
          blue: '#4FA3FF',
          success: '#4ADE80',
          warning: '#FACC15',
          error: '#F87171',
        },
      },
      borderRadius: {
        forge: '14px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
