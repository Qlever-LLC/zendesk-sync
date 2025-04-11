module.exports = {
  content: [
    "./src/routes/**/*.{svelte,js,ts}",
    "./src/lib/components/**/*.{svelte,js,ts}",
  ],
  plugins: [require("@tailwindcss/typography"), require("daisyui")],
  daisyui: {
    themes: ["corporate"],
  },
};
