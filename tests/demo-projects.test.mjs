import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getDemoProjectUrl,
  loadDemoProject
} from "../web/demo-projects.mjs";

const webDirectory = new URL("../web/", import.meta.url);
const currentPointerUrl = new URL("assets/packs/current.json", webDirectory);
const demoProjectUrl = new URL(
  "assets/packs/2026-week-32-pumpin-techno/demo-project.json",
  webDirectory
);

test("the current pack provides the exported A1, A2 and A5 demo patterns", async () => {
  const pointer = JSON.parse(await readFile(currentPointerUrl, "utf8"));
  const project = JSON.parse(await readFile(demoProjectUrl, "utf8"));
  const populated = project.patterns
    .map((pattern, patternIndex) => ({
      patternIndex,
      name: pattern.name,
      activeSteps: pattern.tracks.flatMap((track) => track.steps).filter((step) => step.active).length
    }))
    .filter((pattern) => pattern.activeSteps > 0);

  assert.equal(project.packId, pointer.packId);
  assert.equal(project.patterns.length, 32);
  assert.deepEqual(populated, [
    { patternIndex: 0, name: "A1", activeSteps: 25 },
    { patternIndex: 1, name: "A2", activeSteps: 33 },
    { patternIndex: 4, name: "A5", activeSteps: 25 }
  ]);
  assert.equal(project.selectedTrack, 0);
  assert.equal(project.selectedPattern, 0);
  assert.deepEqual(project.muted, Array(8).fill(false));
});

test("loads and restores a pack-scoped demo project", async () => {
  const rawProject = JSON.parse(await readFile(demoProjectUrl, "utf8"));
  let requestedUrl = null;
  const project = await loadDemoProject(rawProject.packId, {
    moduleUrl: new URL("demo-projects.mjs", webDirectory).href,
    fetchImpl: async (url) => {
      requestedUrl = url;
      return { ok: true, json: async () => structuredClone(rawProject) };
    }
  });

  assert.equal(requestedUrl, demoProjectUrl.href);
  assert.equal(project.packId, rawProject.packId);
  assert.equal(project.patterns[1].controls.tempo, 133);
  assert.equal(project.patterns[4].tracks.length, 8);
});

test("returns no demo URL for packs without a template", async () => {
  assert.equal(getDemoProjectUrl("future-pack"), null);
  assert.equal(await loadDemoProject("future-pack"), null);
});
