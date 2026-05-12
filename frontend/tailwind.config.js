/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        nexo: {
          red:         '#E8223A',
          'red-dark':  '#C41A2E',
          'red-light': '#FDEAED',
          'red-mid':   '#F26070',
          black:       '#0F0F0F',
          'gray-dark': '#3D3D3D',
          'gray-mid':  '#8A8A8A',
          'gray-light':'#F5F5F5',
          border:      '#EBEBEB',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        nexo: '0 2px 12px rgba(232, 34, 58, 0.08)',
      },
      borderRadius: {
        nexo: '12px',
      },
    },
  },
  plugins: [],
};
