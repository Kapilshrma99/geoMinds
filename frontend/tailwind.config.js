export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0d1b2a",
        haze: "#eef4f8",
        mint: "#b8f2e6",
        gold: "#f4d35e",
        coral: "#ee6c4d",
        moss: "#2a9d8f",
        slategeo: "#12263a",
        tide: "#1f4e5f",
        fog: "#dce8ee",
      },
      boxShadow: {
        glow: "0 12px 40px rgba(13, 27, 42, 0.18)",
        panel: "0 24px 60px rgba(9, 25, 39, 0.16)",
      },
      backgroundImage: {
        mesh: "radial-gradient(circle at top left, rgba(184,242,230,0.35), transparent 40%), radial-gradient(circle at top right, rgba(244,211,94,0.18), transparent 28%), linear-gradient(135deg, #f7fbfd 0%, #ebf3f6 40%, #d8e6ed 100%)",
        command: "radial-gradient(circle at 20% 20%, rgba(46, 196, 182, 0.16), transparent 22%), radial-gradient(circle at 80% 0%, rgba(255, 209, 102, 0.16), transparent 18%), linear-gradient(180deg, rgba(10,22,34,0.96) 0%, rgba(18,38,58,0.98) 55%, rgba(11,18,32,1) 100%)",
        topo: "linear-gradient(135deg, rgba(31,78,95,0.2), rgba(255,255,255,0)), repeating-radial-gradient(circle at center, rgba(18,38,58,0.08) 0 2px, transparent 2px 22px)",
      },
      fontFamily: {
        sans: ["'Aptos'", "'Segoe UI'", "sans-serif"],
        display: ["'Bahnschrift'", "'Aptos'", "sans-serif"],
      },
      animation: {
        float: "float 8s ease-in-out infinite",
        shimmer: "shimmer 1.8s linear infinite",
        pulsegrid: "pulsegrid 5s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulsegrid: {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "0.85" },
        },
      },
    },
  },
  plugins: [],
};
