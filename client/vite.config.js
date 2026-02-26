import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server:  { port: 5173 },
  // publicDir คือ client/public → ไฟล์ที่นี่จะ serve ที่ /
  // เช่น client/public/horn.mp3 → http://localhost:5173/horn.mp3
  publicDir: "public",
});
