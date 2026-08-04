import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  exportPackToFile,
  exportPackToDirectory,
  importPackFromDirectory,
  importPackFromFile
} from "../web/pack-transfer.mjs";
import { createInitialState } from "../web/state.mjs";

test("exports and imports pattern data with all eight verified sounds", async () => {
  const root = new MemoryDirectory("exports");
  const delivery = createDelivery();
  const project = createInitialState(delivery.id);
  project.patterns[3].tracks[5].steps[7].active = true;
  project.patterns[3].tracks[5].steps[7].note = 61;

  const result = await exportPackToDirectory(root, {
    project,
    delivery,
    exportedAt: new Date("2026-08-04T05:06:07.000Z")
  });
  const exported = root.directories.get(result.directoryName);

  assert.ok(exported);
  assert.deepEqual(
    [...exported.files.keys()].sort(),
    ["project.json", "manifest.json", ...delivery.manifest.tracks.map((track) => track.file.slice(2))].sort()
  );

  const imported = await importPackFromDirectory(exported, {
    importedAt: new Date("2026-08-04T06:00:00.000Z")
  });

  assert.equal(imported.delivery.id, delivery.id);
  assert.equal(imported.delivery.samples.length, 8);
  assert.equal(imported.project.patterns[3].tracks[5].steps[7].active, true);
  assert.equal(imported.project.patterns[3].tracks[5].steps[7].note, 61);
});

test("rejects a pack when an exported sound has been changed", async () => {
  const root = new MemoryDirectory("exports");
  const delivery = createDelivery();
  const result = await exportPackToDirectory(root, {
    project: createInitialState(delivery.id),
    delivery,
    exportedAt: new Date("2026-08-04T05:06:07.000Z")
  });
  const exported = root.directories.get(result.directoryName);
  exported.files.get("kick.wav").value = Uint8Array.from([9, 9, 9, 9]).buffer;

  await assert.rejects(
    importPackFromDirectory(exported),
    /integrity check/
  );
});

test("round-trips the portable single-file fallback", async () => {
  const delivery = createDelivery();
  const project = createInitialState(delivery.id);
  project.patterns[10].tracks[2].steps[11].active = true;

  const exported = await exportPackToFile({
    project,
    delivery,
    exportedAt: new Date("2026-08-04T05:06:07.000Z")
  });
  const imported = await importPackFromFile(exported.blob);

  assert.match(exported.filename, /\.wgbpack$/);
  assert.equal(imported.delivery.samples.length, 8);
  assert.equal(imported.project.patterns[10].tracks[2].steps[11].active, true);
});

function createDelivery() {
  const id = "2026-week-32-test-pack";
  const names = ["kick", "snare", "hi-hat", "perc", "bass", "lead", "chord", "texture"];
  const samples = names.map((trackId, index) => ({
    trackId,
    contentType: "audio/wav",
    data: Uint8Array.from([index + 1, index + 2, index + 3, index + 4]).buffer
  }));
  const tracks = names.map((trackId, index) => {
    const data = samples[index].data;
    return {
      id: trackId,
      name: trackId,
      kind: index < 4 ? "drum" : "chromatic",
      ...(index < 4 ? {} : { rootNote: 48 }),
      file: `./${trackId}.wav`,
      byteLength: data.byteLength,
      sha256: createHash("sha256").update(new Uint8Array(data)).digest("hex")
    };
  });

  return {
    id,
    manifest: {
      schemaVersion: 1,
      id,
      year: 2026,
      calendarWeek: 32,
      week: 2,
      name: "Test Pack",
      license: "Test",
      releasedAt: "2026-08-03T00:00:00.000Z",
      expiresAt: "2026-08-10T00:00:00.000Z",
      tracks
    },
    samples,
    storedAt: "2026-08-04T00:00:00.000Z"
  };
}

class MemoryDirectory {
  constructor(name) {
    this.name = name;
    this.files = new Map();
    this.directories = new Map();
  }

  async getDirectoryHandle(name, { create = false } = {}) {
    if (!this.directories.has(name) && create) {
      this.directories.set(name, new MemoryDirectory(name));
    }
    if (!this.directories.has(name)) throw notFoundError();
    return this.directories.get(name);
  }

  async getFileHandle(name, { create = false } = {}) {
    if (!this.files.has(name) && create) this.files.set(name, new MemoryFile(name));
    if (!this.files.has(name)) throw notFoundError();
    return this.files.get(name);
  }
}

class MemoryFile {
  constructor(name) {
    this.name = name;
    this.value = "";
  }

  async createWritable() {
    return {
      write: async (value) => {
        this.value = typeof value === "string" ? value : value.slice(0);
      },
      close: async () => {}
    };
  }

  async getFile() {
    return {
      type: this.name.endsWith(".wav") ? "audio/wav" : "application/json",
      text: async () => typeof this.value === "string"
        ? this.value
        : new TextDecoder().decode(this.value),
      arrayBuffer: async () => typeof this.value === "string"
        ? new TextEncoder().encode(this.value).buffer
        : this.value.slice(0)
    };
  }
}

function notFoundError() {
  const error = new Error("Not found");
  error.name = "NotFoundError";
  return error;
}
