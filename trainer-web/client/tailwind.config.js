/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nexora: {
          primary: '#ff4655',
          secondary: '#0f1923',
          accent: '#00ff88'
        }
      }
    },
  },
  plugins: [],
}
