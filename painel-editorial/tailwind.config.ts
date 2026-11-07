import type { Config } from "tailwindcss";

/**
 * Paleta "brand" reaproveitada do SEO Analyst (raiz do repositório) para manter
 * o sistema visual da MAFRA. Base clara, tokens semânticos via CSS variables.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#e0effe",
          200: "#bae0fd",
          300: "#7cc8fc",
          400: "#36adf8",
          500: "#0c93e9",
          600: "#0074c7",
          700: "#015ca1",
          800: "#064f85",
          900: "#0b426e",
          950: "#072a49",
        },
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        subtle: "var(--subtle)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        faint: "var(--faint)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        serif: ["Charter", "Georgia", "Cambria", "Times New Roman", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      maxWidth: { prose: "72ch" },
    },
  },
  plugins: [],
};
export default config;
