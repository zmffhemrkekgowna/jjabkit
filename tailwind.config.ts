import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { serif: ['"Noto Serif KR"', "Georgia", "serif"] },
      colors: {
        bg: "var(--bg)", card: "var(--card)", ink: "var(--ink)", mute: "var(--mute)", line: "var(--line)",
        brand: "var(--brand)", onbrand: "var(--onbrand)", hit: "var(--hit)", slot: "var(--slot)", onslot: "var(--onslot)", gold: "var(--gold)",
      },
    },
  },
  plugins: [],
};
export default config;
