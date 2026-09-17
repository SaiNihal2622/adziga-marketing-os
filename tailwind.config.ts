import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f6f7f9",
          100: "#eceef2",
          200: "#d5d9e2",
          300: "#b1b8c8",
          400: "#8791a7",
          500: "#677289",
          600: "#525d72",
          700: "#43495a",
          800: "#3a3f4d",
          900: "#1c1f27",
          950: "#0d1015"
        },
        brand: {
          50: "#eef4ff",
          100: "#dde8ff",
          200: "#bcd2ff",
          300: "#8eb1ff",
          400: "#5a85ff",
          500: "#365efb",
          600: "#243ff0",
          700: "#1d31d8",
          800: "#1c2cae",
          900: "#1d2a89"
        },
        accent: {
          50: "#fdf4ff",
          100: "#fae8ff",
          200: "#f5d0fe",
          300: "#f0abfc",
          400: "#e879f9",
          500: "#d946ef",
          600: "#c026d3"
        },
        success: { 500: "#10b981", 600: "#059669" },
        warning: { 500: "#f59e0b", 600: "#d97706" },
        danger: { 500: "#ef4444", 600: "#dc2626" }
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"]
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.05)",
        ring: "0 0 0 1px rgba(15,23,42,0.06)"
      }
    }
  },
  plugins: []
};

export default config;