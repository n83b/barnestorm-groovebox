import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_SOURCE_DIRECTORY = new URL("../web/", import.meta.url);
const DEFAULT_OUTPUT_DIRECTORY = new URL("../dist/", import.meta.url);
const DEFAULT_HOSTING_FILE = new URL("../.openai/hosting.json", import.meta.url);
const VERSION_QUERY_PATTERN = /\?v=[a-zA-Z0-9._-]+/g;
const SHELL_CACHE_PATTERN = /weekly-groovebox-shell-[a-zA-Z0-9._-]+/g;
const VERSIONED_TEXT_EXTENSIONS = new Set([".css", ".html", ".js", ".mjs"]);

export async function buildSite({
  sourceDirectory = DEFAULT_SOURCE_DIRECTORY,
  outputDirectory = DEFAULT_OUTPUT_DIRECTORY,
  hostingFile = DEFAULT_HOSTING_FILE
} = {}) {
  const sourcePath = toPath(sourceDirectory);
  const outputPath = toPath(outputDirectory);
  const clientPath = resolve(outputPath, "client");
  const serverPath = resolve(outputPath, "server");
  const hostingOutputPath = resolve(outputPath, ".openai", "hosting.json");
  const buildId = await createBuildFingerprint(sourcePath);

  await rm(outputPath, { recursive: true, force: true });
  await mkdir(serverPath, { recursive: true });
  await cp(sourcePath, clientPath, { recursive: true });
  await applyReleaseFingerprint(clientPath, buildId);
  await writeFile(
    resolve(serverPath, "index.js"),
    `export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
`,
    "utf8"
  );
  await mkdir(dirname(hostingOutputPath), { recursive: true });
  await cp(toPath(hostingFile), hostingOutputPath);

  return { buildId, clientPath, outputPath, serverPath };
}

export async function createBuildFingerprint(directory) {
  const root = toPath(directory);
  const files = await listFiles(root);
  const hash = createHash("sha256");

  for (const filename of files) {
    hash.update(relative(root, filename));
    hash.update("\0");
    hash.update(await readFile(filename));
    hash.update("\0");
  }

  return hash.digest("hex").slice(0, 12);
}

export async function applyReleaseFingerprint(directory, buildId) {
  const files = await listFiles(toPath(directory));
  await Promise.all(files.map(async (filename) => {
    if (!VERSIONED_TEXT_EXTENSIONS.has(extname(filename))) return;
    const source = await readFile(filename, "utf8");
    const output = replaceReleaseFingerprint(source, buildId);
    if (output !== source) await writeFile(filename, output, "utf8");
  }));
}

export function replaceReleaseFingerprint(source, buildId) {
  if (!/^[a-f0-9]{12}$/.test(buildId)) {
    throw new TypeError("The release fingerprint must be a 12-character hexadecimal value.");
  }
  return source
    .replace(VERSION_QUERY_PATTERN, `?v=${buildId}`)
    .replace(SHELL_CACHE_PATTERN, `weekly-groovebox-shell-${buildId}`);
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const filename = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(filename) : [filename];
  }));
  return files.flat().sort();
}

function toPath(value) {
  return value instanceof URL ? fileURLToPath(value) : resolve(value);
}

function isMainModule() {
  return process.argv[1]
    && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
}

if (isMainModule()) {
  const { buildId } = await buildSite();
  process.stdout.write(`Built Weekly Groovebox release ${buildId}.\n`);
}
