import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createPack,
  getIsoWeekWindow,
  parsePackDirectoryName
} from "../tools/create-pack.mjs";

const SAMPLE_FILES = [
  "kick.wav",
  "snare.wav",
  "hi-hat.wav",
  "perc.wav",
  "bass.wav",
  "lead.wav",
  "chord.wav",
  "texture.wav"
];

test("infers pack metadata and a Monday UTC release window from the folder", () => {
  assert.deepEqual(
    parsePackDirectoryName("2026-week-32-found-signals"),
    {
      id: "2026-week-32-found-signals",
      year: 2026,
      week: 32,
      name: "Found Signals",
      releasedAt: "2026-08-03T00:00:00.000Z",
      expiresAt: "2026-08-10T00:00:00.000Z"
    }
  );
  assert.throws(() => parsePackDirectoryName("week-32-found-signals"), /YYYY-week-WW/);
  assert.throws(() => getIsoWeekWindow(2021, 53), /does not contain ISO week 53/);
});

test("creates a complete manifest and current pointer from eight named WAV files", async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "weekly-groovebox-pack-"));
  context.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  const packDirectory = join(temporaryRoot, "2026-week-32-found-signals");
  const pointerFile = join(temporaryRoot, "current.json");
  await mkdir(packDirectory);

  for (const [index, filename] of SAMPLE_FILES.entries()) {
    await writeFile(join(packDirectory, filename), createTestWav(index));
  }

  const result = await createPack({
    packDirectory,
    pointerFile,
    license: "Test license",
    rootNote: 60
  });
  const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));
  const pointer = JSON.parse(await readFile(pointerFile, "utf8"));

  assert.equal(manifest.id, "2026-week-32-found-signals");
  assert.equal(manifest.calendarWeek, 32);
  assert.equal(manifest.week, 1);
  assert.equal(manifest.name, "Found Signals");
  assert.equal(manifest.license, "Test license");
  assert.equal(manifest.tracks.length, 8);
  assert.equal(manifest.tracks[0].file, "./kick.wav");
  assert.equal(manifest.tracks[0].sha256.length, 64);
  assert.equal(manifest.tracks[4].rootNote, 60);
  assert.equal(pointer.packId, manifest.id);
  assert.equal(pointer.manifestUrl, "./2026-week-32-found-signals/manifest.json");
  assert.equal(pointer.releasedAt, "2026-08-03T00:00:00.000Z");

  const nextPackDirectory = join(temporaryRoot, "2026-week-33-night-transmission");
  await mkdir(nextPackDirectory);
  for (const [index, filename] of SAMPLE_FILES.entries()) {
    await writeFile(join(nextPackDirectory, filename), createTestWav(index + 8));
  }

  const nextResult = await createPack({
    packDirectory: nextPackDirectory,
    pointerFile
  });
  const nextManifest = JSON.parse(await readFile(nextResult.manifestPath, "utf8"));

  assert.equal(nextManifest.calendarWeek, 33);
  assert.equal(nextManifest.week, 2);
});

function createTestWav(seed) {
  const wav = Buffer.alloc(45);
  wav.write("RIFF", 0, "ascii");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVE", 8, "ascii");
  wav.write("fmt ", 12, "ascii");
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(44_100, 24);
  wav.writeUInt32LE(88_200, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36, "ascii");
  wav.writeUInt32LE(1, 40);
  wav[44] = seed;
  return wav;
}
