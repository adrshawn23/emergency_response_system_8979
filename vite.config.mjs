import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tagger from "@dhiwise/component-tagger";

export default defineConfig({
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 2000,
  },

  plugins: [
    tsconfigPaths(),
    react(),
    // The visual editor tagger walks parent folders in some environments.
    // Keep it available for Rocket editing, but allow constrained CI builds to opt out.
    ...(process.env.VITE_DISABLE_TAGGER ? [] : [tagger()]),
  ],

  server: {
    port: 4028,
    host: "0.0.0.0",
    strictPort: true,
    allowedHosts: [
      ".amazonaws.com",
      ".builtwithrocket.new",
    ],
  },
});
