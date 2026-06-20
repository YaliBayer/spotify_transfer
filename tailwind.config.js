/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#15171F",
        paper: "#F3EFE3",
        brass: "#C99A4B",
        rail: "#5B6B86",
        sage: "#6E9B7B",
        rust: "#C2542C",
        line: "rgba(243,239,227,0.12)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
};
