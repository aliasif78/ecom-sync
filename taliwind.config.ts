import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/pages/**/*.{js,ts,jsx,tsx,mdx}", "./src/components/**/*.{js,ts,jsx,tsx,mdx}", "./src/app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "#020617", // Deep Slate
        primary: "#6366f1", // Electric Indigo
        success: "#10b981", // Emerald
        error: "#f43f5e", // Rose
      },
    },
  },
  plugins: [],
};
export default config;
