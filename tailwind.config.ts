import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bmoni: {
          bg: "#0A0E14",
          card: "#121822",
          line: "#1E2937",
          accent: "#00E5A0",
          accent2: "#7C5CFF",
          text: "#E6EDF3",
          dim: "#8B98A9",
        },
      },
    },
  },
  plugins: [],
};
export default config;
