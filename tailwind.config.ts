import type { Config } from "tailwindcss";

// Tailwind v4 uses CSS-based configuration (via @theme in globals.css)
// This file is kept for compatibility but most config is in the CSS
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
};

export default config;
