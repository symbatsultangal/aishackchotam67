import animate from "tailwindcss-animate";
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                brand: {
                    purple: "#4A1E6B",
                    accent: "#6B2FA0",
                    orange: "#F5A623",
                },
                background: "#F8F8F8",
                foreground: "#1A1A1A",
                card: "#FFFFFF",
                muted: "#6B7280",
                border: "#E5E7EB",
                success: "#22C55E",
                warning: "#F59E0B",
                error: "#EF4444",
            },
            fontFamily: {
                sans: ["Geist", "ui-sans-serif", "system-ui", "sans-serif"],
            },
            borderRadius: {
                lg: "8px",
                md: "6px",
                sm: "4px",
            },
            keyframes: {
                progress: {
                    "0%": { transform: "translateX(-100%)" },
                    "100%": { transform: "translateX(100%)" },
                },
                bounceDot: {
                    "0%, 80%, 100%": { transform: "scale(0.8)", opacity: "0.45" },
                    "40%": { transform: "scale(1)", opacity: "1" },
                },
                waveform: {
                    "0%, 100%": { transform: "scaleY(0.35)" },
                    "50%": { transform: "scaleY(1)" },
                },
            },
            animation: {
                progress: "progress 1.4s ease-in-out infinite",
                bounceDot: "bounceDot 1.2s ease-in-out infinite",
                waveform: "waveform 0.7s ease-in-out infinite",
            },
        },
    },
    plugins: [animate],
};
