import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig({
  server: {
    port: 8080,
  },
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    tanstackStart({
      srcDirectory: "src",
      server: { entry: "server" },
    }),
    // viteReact must come after tanstackStart.
    viteReact(),
    // Default preset is node-server, which is what Railway runs.
    nitro(),
  ],
});
