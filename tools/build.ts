import { cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = new URL("../dist/", import.meta.url);

await build({
  root,
  base: "./",
  build: {
    outDir: "dist",
    assetsDir: "bundles",
    emptyOutDir: true,
  },
});

// Files loaded directly by the page or through paths in app.js.
for (const path of ["app.js", "data", "assets", "lib/vendor"]) {
  await cp(
    new URL(`../${path}`, import.meta.url),
    new URL(path, output),
    { recursive: true },
  );
}
