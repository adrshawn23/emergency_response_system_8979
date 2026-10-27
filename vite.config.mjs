import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tagger from "@dhiwise/component-tagger";

export default defineConfig(({ mode }) => ({
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 2000,
  },

  plugins: [
    tsconfigPaths(),
    react(),
    // Keep Rocket's editor tagger out of deployed builds: its preview runtime
    // makes cross-origin tracking calls that production hosts may block.
    ...(mode === "development" && !process.env.VITE_DISABLE_TAGGER ? [tagger()] : []),
  ],

  server: {
    port: 4190,
    host: "0.0.0.0",
    strictPort: true,
    allowedHosts: [
      ".amazonaws.com",
      ".builtwithrocket.new",
    ],
  },
}));
