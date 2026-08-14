import { defineConfig, type Plugin } from "vite";
import path from "node:path";
import react from "@vitejs/plugin-react";

const devProxyTarget = (port: number) => ({
  target: `http://localhost:${port}`,
  changeOrigin: true,
});

const host = process.env.TAURI_DEV_HOST;
const KIB = 1024;

const enforceChunkBudgets = (): Plugin => ({
  name: "lxlink-chunk-budgets",
  apply: "build",
  generateBundle(_options, bundle) {
    for (const output of Object.values(bundle)) {
      if (output.type !== "chunk") continue;
      const isMonaco = output.fileName.includes("monaco");
      const budgetKiB = isMonaco ? 4200 : 500;
      if (output.code.length > budgetKiB * KIB) {
        this.error(
          `${output.fileName} is ${(output.code.length / KIB).toFixed(1)} KiB; ` +
          `the configured budget is ${budgetKiB} KiB.`,
        );
      }
    }
  },
});

// Custom Sass importer to resolve @scss alias
const sassImporter = {
  findFileUrl(url: string): URL | null {
    if (url.startsWith("@scss/")) {
      const resolvedPath = path.resolve(__dirname, "src/scss", url.replace("@scss/", ""));
      return new URL(`file://${resolvedPath}`);
    }
    return null;
  },
};

export default defineConfig({
  plugins: [react(), enforceChunkBudgets()],
  resolve: {
    alias: [
      { find: "@renderer", replacement: path.resolve(__dirname, "src/renderer/") },
      { find: "@main", replacement: path.resolve(__dirname, "src/main/") },
      { find: "@locales", replacement: path.resolve(__dirname, "src/locales/index.ts") },
      { find: "@locales/", replacement: path.resolve(__dirname, "src/locales/") },
      { find: "@types", replacement: path.resolve(__dirname, "src/types/") },
      { find: "@scss", replacement: path.resolve(__dirname, "src/scss/") }
    ]
  },
  css: {
    preprocessorOptions: {
      scss: {
        importers: [sassImporter as any],
      },
    },
  },
  worker: {
    format: "es",
  },
  build: {
    sourcemap: true,
    emptyOutDir: true,
    // Monaco is intentionally bundled for offline desktop use and has its own
    // stricter named-chunk budget in enforceChunkBudgets above.
    chunkSizeWarningLimit: 4200,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        splash: path.resolve(__dirname, "splash.html"),
      },
      output: {
        // Monaco is bundled locally (no CDN in the packaged app) — keep it out
        // of the entry chunk so the first paint isn't blocked by it.
        manualChunks: (id) => {
          if (id.includes("monaco-editor")) return "monaco";
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules[\\/](@?react|react-dom|react-router|react-redux|@reduxjs)/.test(id)) return "vendor-react";
          if (id.includes("@supabase") || id.includes("@realtime-js")) return "vendor-supabase";
          if (id.includes("livekit") || id.includes("@livekit")) return "vendor-livekit";
          if (id.includes("emoji-picker-react")) return "vendor-emoji";
          if (id.includes("@tauri-apps")) return "vendor-tauri";
          if (id.includes("i18next")) return "vendor-i18n";
          if (id.includes("libsodium") || id.includes("tweetnacl")) return "vendor-crypto";
          if (id.includes("@microsoft/signalr")) return "vendor-signalr";
          if (id.includes("lucide-react") || id.includes("@primer") || id.includes("@radix-ui") || id.includes("motion")) return "vendor-ui";
          return undefined;
        },
      },
    },
  },
  clearScreen: false,
  server: {
    host: host || false,
    port: 5176,
    strictPort: true,
    hmr: host ? { protocol: "ws", host, port: 5183 } : undefined,
    proxy: {
      "/api/auth": devProxyTarget(5001),
      "/api/users/@me/avatar": devProxyTarget(5005),
      "/api/users/@me/banner": devProxyTarget(5005),
      "/api/users": devProxyTarget(5002),
      "/api/guilds": devProxyTarget(5003),
      "/api/messages": devProxyTarget(5004),
      "/api/media": devProxyTarget(5005),
      "/api/voice": devProxyTarget(5006),
      "/realtime": {
        target: "http://localhost:6000",
        ws: true,
        changeOrigin: true,
        rewrite: (incomingPath) => incomingPath.replace(/^\/realtime/, ""),
      },
    },
  }
});
