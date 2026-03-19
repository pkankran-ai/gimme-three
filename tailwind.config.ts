import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#16110f",
        paper: "#f7f1e8",
        sand: "#eadfce",
        clay: "#d6b48c",
        moss: "#60735f",
        ember: "#b45d45"
      },
      boxShadow: {
        card: "0 20px 45px rgba(39, 28, 23, 0.12)"
      },
      animation: {
        "fade-up": "fade-up 0.7s ease-out both"
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      }
    }
  },
  plugins: []
};

export default config;
