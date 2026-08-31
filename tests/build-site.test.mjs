import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createBuildFingerprint,
  replaceReleaseFingerprint
} from "../tools/build-site.mjs";

test("replaces development versions and the shell cache with one release fingerprint", () => {
  const buildId = "a1b2c3d4e5f6";
  const source = `
    import "./app.mjs?v=dev";
    const stylesheet = "./styles.css?v=16";
    const cache = "barnestorm-groovebox-shell-dev";
  `;
  const output = replaceReleaseFingerprint(source, buildId);

  assert.doesNotMatch(output, /\?v=(?:dev|16)/);
  assert.equal(output.match(new RegExp(`\\?v=${buildId}`, "g")).length, 2);
  assert.match(output, new RegExp(`barnestorm-groovebox-shell-${buildId}`));
});

test("changes the build fingerprint whenever source content changes", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "barnestorm-groovebox-build-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const filename = join(directory, "app.mjs");

  await writeFile(filename, "export const version = 1;\n");
  const first = await createBuildFingerprint(directory);
  await writeFile(filename, "export const version = 2;\n");
  const second = await createBuildFingerprint(directory);

  assert.match(first, /^[a-f0-9]{12}$/);
  assert.match(second, /^[a-f0-9]{12}$/);
  assert.notEqual(first, second);
});
