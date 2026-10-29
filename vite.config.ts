import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Docker/local API SPA: /app/  |  GitHub project Pages: /<repo>/
const base = process.env.VITE_BASE || "/app/";

export default defineConfig({
  plugins: [react()],
  base,
  server: {
    port: 5173,
    proxy: {
      "/me": "http://localhost:8000",
      "/feed": "http://localhost:8000",
      "/browse": "http://localhost:8000",
      "/swipe": "http://localhost:8000",
      "/filters": "http://localhost:8000",
      "/favorites": "http://localhost:8000",
      "/hidden": "http://localhost:8000",
      "/search": "http://localhost:8000",
      "/nlp": "http://localhost:8000",
      "/payments": "http://localhost:8000",
      "/health": "http://localhost:8000",
      "/media": "http://localhost:8000",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
