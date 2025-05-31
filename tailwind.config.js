/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'sky-blue': '#87CEEB',
        'sky-blue-dark': '#70B8D8',
        'sky-blue-light': '#A0D8EF',
      },
      fontFamily: {
        'radey': ['Radey', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
