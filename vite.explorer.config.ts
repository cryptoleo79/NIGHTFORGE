import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Lightweight explorer-only build - no WASM, no wallet SDK
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist-explorer",
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "explorer.html"),
      },
    },
    minify: "esbuild",
    target: "es2020",
  },
  define: {
    "process.env": {},
  },
});
