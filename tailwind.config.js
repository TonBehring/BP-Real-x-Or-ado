/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
      },
      colors: {
        // Paleta herdada das planilhas originais Real x Orçado
        'bp-black': '#000000',
        'bp-subtitle': '#D9E1F2',
        'bp-header': '#434343',
        'bp-realized': '#F2F2F2',
        'bp-total': '#666666',
        'bp-economia': '#2E7D32',
        'bp-estouro': '#C62828',
        'bp-forecast': '#1A56DB',
      },
    },
  },
  plugins: [],
};
