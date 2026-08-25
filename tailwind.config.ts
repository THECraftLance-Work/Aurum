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
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        ink: "var(--color-text)",
        accent: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-600)",
          dark: "var(--color-accent-700)",
          light: "var(--color-accent-100)"
        },
        divider: "var(--color-divider)",
        border: "var(--color-divider)",
        input: "var(--color-surface)",
        ring: "var(--color-accent)",
        background: "var(--color-bg)",
        foreground: "var(--color-text)",
        muted: {
          DEFAULT: "var(--color-surface)",
          foreground: "var(--color-neutral-600)"
        },
        card: {
          DEFAULT: "var(--color-bg)",
          foreground: "var(--color-text)"
        },
        role: {
          sm: "#0284c7",
          cp: "#059669",
          accountant: "#d97706",
          admin: "#475569",
          director: "#ec3013"
        }
      },
      borderRadius: {
        none: "0px",
        sm: "0px",
        md: "2px",
        lg: "4px",
        xl: "6px",
        "2xl": "8px"
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        card: "0 1px 2px rgba(45, 43, 43, 0.08)",
        pop: "0 8px 24px rgba(45, 43, 43, 0.12)",
        lift: "0 6px 20px -4px rgba(45, 43, 43, 0.14)"
      },
      fontFamily: {
        sans: ["var(--font-archivo)", "Archivo", "system-ui", "-apple-system", "sans-serif"],
        heading: ["var(--font-archivo)", "Archivo", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "JetBrains Mono", "monospace"]
      },
      transitionTimingFunction: {
        "out-quint": "cubic-bezier(0.22, 1, 0.36, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)"
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" }
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "none" }
        },
        "fade-in-down": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "none" }
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" }
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(16px)" },
          to: { opacity: "1", transform: "none" }
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-16px)" },
          to: { opacity: "1", transform: "none" }
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" }
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "70%": { transform: "scale(1.6)", opacity: "0" },
          "100%": { transform: "scale(1.6)", opacity: "0" }
        },
        "bar-grow": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" }
        }
      },
      animation: {
        "fade-in": "fade-in 240ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in-up": "fade-in-up 320ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in-down": "fade-in-down 320ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "scale-in": "scale-in 200ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-in-right": "slide-in-right 300ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-in-left": "slide-in-left 300ms cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 1.5s infinite",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.22, 1, 0.36, 1) infinite",
        "bar-grow": "bar-grow 600ms cubic-bezier(0.22, 1, 0.36, 1) both"
      }
    }
  },
  plugins: []
};
export default config;
