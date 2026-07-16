/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bakery: {
          50: '#fdf8f0',
          100: '#faecd8',
          200: '#f5d5a8',
          300: '#f0b96e',
          400: '#ec9e3e',
          500: '#e08522',
          600: '#c66a18',
          700: '#a34f16',
          800: '#853f19',
          900: '#6e3518',
        },
        cream: '#fdf8f0',
        chocolate: '#5c3317',
        caramel: '#ec9e3e',
        rose: '#e8a0b4',
      },
    },
  },
  plugins: [],
}
