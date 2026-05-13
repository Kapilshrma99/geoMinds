export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#040b14",
        haze: "#eaf2ff",
        mint: "#67f7c4",
        gold: "#ffbf69",
        coral: "#ff6f7d",
        moss: "#2fd2b5",
        slategeo: "#0c1b2d",
        tide: "#15304d",
        fog: "#8ea4bf",
        storm: "#0b1624",
        steel: "#18283a",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(103,247,196,0.08), 0 24px 70px rgba(0,0,0,0.45)",
        panel: "0 24px 80px rgba(0, 0, 0, 0.42)",
      },
      backgroundImage: {
        mesh: "radial-gradient(circle at 0% 0%, rgba(103,247,196,0.14), transparent 26%), radial-gradient(circle at 100% 0%, rgba(72,169,255,0.12), transparent 22%), linear-gradient(180deg, #030912 0%, #071320 52%, #0a1b2c 100%)",
        command: "radial-gradient(circle at 20% 16%, rgba(103,247,196,0.14), transparent 20%), radial-gradient(circle at 80% 0%, rgba(255,191,105,0.12), transparent 18%), linear-gradient(180deg, rgba(3,9,18,0.96) 0%, rgba(7,19,32,0.98) 52%, rgba(10,27,44,1) 100%)",
        topo: "linear-gradient(135deg, rgba(103,247,196,0.08), transparent 40%), repeating-radial-gradient(circle at center, rgba(103,247,196,0.06) 0 2px, transparent 2px 22px)",
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "'Segoe UI'", "sans-serif"],
        display: ["'Space Grotesk'", "'Plus Jakarta Sans'", "sans-serif"],
      },
      animation: {
        float: "float 8s ease-in-out infinite",
        shimmer: "shimmer 1.8s linear infinite",
        pulsegrid: "pulsegrid 5s ease-in-out infinite",
        pulseglow: "pulseglow 2.4s ease-in-out infinite",
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
        pulseglow: {
          "0%, 100%": { boxShadow: "0 0 0 rgba(103,247,196,0.0)" },
          "50%": { boxShadow: "0 0 24px rgba(103,247,196,0.3)" },
        },
      },
    },
  },
  plugins: [],
};
