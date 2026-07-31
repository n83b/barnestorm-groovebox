import { cp, mkdir, rm, writeFile } from "node:fs/promises";

const outputDirectory = new URL("../dist/", import.meta.url);
const clientDirectory = new URL("./client/", outputDirectory);
const serverDirectory = new URL("./server/", outputDirectory);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(serverDirectory, { recursive: true });
await cp(new URL("../web/", import.meta.url), clientDirectory, {
  recursive: true,
});

await writeFile(
  new URL("./index.js", serverDirectory),
  `export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
`,
);
