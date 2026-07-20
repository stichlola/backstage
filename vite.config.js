import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "Backstage — Repertorio band",
        short_name: "Backstage",
        description: "Gestione repertorio, scalette e prove della tua band",
        lang: "it",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#16112B",
        theme_color: "#16112B",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
        runtimeCaching: [
          {
            // CSS dei font Google
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-css" },
          },
          {
            // file dei font
            urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: { cacheName: "google-fonts-files", expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            // letture dal database: rete prima, cache come riserva offline
            urlPattern: ({ url, request }) =>
              url.hostname.endsWith(".supabase.co") &&
              url.pathname.startsWith("/rest/v1") &&
              request.method === "GET",
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-data",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            // copertine iTunes
            urlPattern: ({ url }) => url.hostname.endsWith("mzstatic.com"),
            handler: "CacheFirst",
            options: { cacheName: "artwork", expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
});
