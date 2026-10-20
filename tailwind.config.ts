import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        noc: {
          bg: "#0a0e14",
          panel: "#10161f",
          card: "#141c28",
          border: "#1e2936",
          accent: "#38bdf8",
          ok: "#34d399",
          warn: "#fbbf24",
          crit: "#f87171",
        },
      },
    },
  },
  plugins: [],
};
export default config;
