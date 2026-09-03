import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  dts: false,
  // Emit dist/index.js (package "type": "module"), not .mjs.
  fixedExtension: false,
  // Keep the CLI shebang so `datagouv-mcp` works as a bin.
  banner: { js: "#!/usr/bin/env node" },
});
