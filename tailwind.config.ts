import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f7f8fa",
          100: "#eef0f4",
          200: "#dde1ea",
          300: "#b9c0cd",
          400: "#8791a7",
          500: "#677289",
          600: "#525d72",
          700: "#3a3f4d",
          800: "#262a33",
          900: "#1c1f27",
          950: "#0d1015"
        },
        // Adziga brand palette — sourced from the official Artboard SVGs.
        // Primary mark is orange #f36d21 on near-black; secondary is the warm cream surface.
        brand: {
          50: "#fff4ec",
          100: "#ffe5d2",
          200: "#ffc7a5",
          300: "#ffa06d",
          400: "#fb7d3d",
          500: "#f36d21", // primary brand mark
          600: "#e35a0f",
          700: "#bd460b",
          800: "#96390e",
          900: "#793010"
        },
        // Charcoal — used for the dark mark, deep backgrounds, premium feel.
        charcoal: {
          50: "#f6f6f7",
          100: "#e7e7ea",
          200: "#c8c9cf",
          300: "#a4a6b1",
          400: "#797d8c",
          500: "#565a68",
          600: "#3e414b",
          700: "#2a2c34",
          800: "#1b1c22",
          900: "#0e0f13"
        },
        accent: {
          // Warm yellow-gold accent — complementary to brand orange. Used for highlights
          // and active states; never as a primary CTA color.
          50: "#fffaeb",
          100: "#fff1c6",
          200: "#ffe189",
          300: "#ffca4d",
          400: "#ffb322",
          500: "#f99707",
          600: "#dc6e05",
          700: "#b65009",
          800: "#943e0f",
          900: "#7a3411"
        },
        success: { 500: "#10b981", 600: "#059669", 50: "#ecfdf5", 700: "#047857" },
        warning: { 500: "#f59e0b", 600: "#d97706", 50: "#fffbeb", 700: "#b45309" },
        danger: { 500: "#ef4444", 600: "#dc2626", 50: "#fef2f2", 700: "#b91c1c" }
      },
      fontFamily: {
        sans: ["Geist", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "SFMono-Regular", "monospace"],
        display: ["Geist", "Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.05)",
        ring: "0 0 0 1px rgba(15,23,42,0.06)",
        // Subtle brand-tinted shadow used on hover for primary CTA cards
        "brand-soft": "0 1px 2px rgba(243,109,33,0.06), 0 8px 24px rgba(243,109,33,0.08)",
        "card-hover": "0 2px 4px rgba(15,23,42,0.04), 0 12px 32px rgba(15,23,42,0.08)"
      },
      borderRadius: {
        // Slightly tighter than default — modern editorial feel.
        sm: "0.375rem",
        md: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem"
      },
      letterSpacing: {
        tightest: "-0.025em",
        tighter: "-0.015em"
      }
    }
  },
  plugins: []
};

export default config;