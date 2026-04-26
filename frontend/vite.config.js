import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8069,
    // Expose on LAN for demos (access via http://<your-ip>:8069)
    host: true,
    proxy: {
      // Default dev setup: same-origin /api and /ws/* → FastAPI on 7155 (CORS not required on the browser).
      "/api": { target: "http://127.0.0.1:7155", changeOrigin: true },
      "/ws": { target: "http://127.0.0.1:7155", changeOrigin: true, ws: true },
    },
  },
});
