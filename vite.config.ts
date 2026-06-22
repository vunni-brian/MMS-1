/**
 * Vite build configuration for the MMS frontend.
 * Configures the dev server, React SWC plugin, path aliases,
 * and manual chunk splitting for optimized production bundles.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Dev server listens on all IPv6 addresses, port 8080, with HMR overlay disabled
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  // React SWC plugin for fast refresh; componentTagger only in development
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Deduplicate React to avoid multiple copies when linked packages are present
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Keep React and its ecosystem in one chunk — loaded first
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router-dom/") ||
            id.includes("node_modules/react-i18next/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "vendor-react";
          }
          // UI libs that depend on React — loaded after vendor-react
          if (
            id.includes("node_modules/recharts/") ||
            id.includes("node_modules/lucide-react/") ||
            id.includes("node_modules/@radix-ui/")
          ) {
            return "vendor-ui";
          }
          // Pure data libs with no React dependency
          if (
            id.includes("node_modules/@tanstack/react-query/") ||
            id.includes("node_modules/date-fns/")
          ) {
            return "vendor-data";
          }
        },
      },
    },
  },
}));
