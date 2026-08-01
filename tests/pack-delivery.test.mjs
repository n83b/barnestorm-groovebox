import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PackDelivery,
  getDaysRemaining,
  validatePackPointer
} from "../web/pack-delivery.mjs";
import { validatePackManifest } from "../web/sequencer.mjs";

const webDirectory = new URL("../web/", import.meta.url);

test("validates and resolves the current pack pointer", () => {
  const pointer = validatePackPointer({
    schemaVersion: 1,
    packId: "2026-week-31-test",
    manifestUrl: "./week-31/manifest.json",
    releasedAt: "2026-07-27T00:00:00Z",
    expiresAt: "2026-08-03T00:00:00Z"
  }, "https://example.com/assets/packs/current.json");

  assert.equal(pointer.manifestUrl, "https://example.com/assets/packs/week-31/manifest.json");
  assert.equal(getDaysRemaining(pointer.expiresAt, new Date("2026-08-01T00:00:00Z")), 2);
  assert.throws(
    () => validatePackPointer({ ...pointer, expiresAt: pointer.releasedAt }),
    /after its release/
  );
});

test("the published current pack has valid metadata and sample hashes", async () => {
  const pointerFile = new URL("assets/packs/current.json", webDirectory);
  const pointer = validatePackPointer(
    JSON.parse(await readFile(pointerFile, "utf8")),
    pointerFile
  );
  const manifestFile = new URL(pointer.manifestUrl);
  const manifest = validatePackManifest(
    JSON.parse(await readFile(manifestFile, "utf8"))
  );

  assert.equal(manifest.id, pointer.packId);
  for (const track of manifest.tracks) {
    const audio = await readFile(new URL(track.file, manifestFile));
    assert.equal(audio.byteLength, track.byteLength);
    assert.equal(createHash("sha256").update(audio).digest("hex"), track.sha256);
  }
});

test("uses a complete cached pack when the current pointer is offline", async () => {
  const cached = {
    id: "cached-pack",
    manifest: { id: "cached-pack", week: 30, name: "Cached", tracks: Array(8) },
    samples: Array(8),
    storedAt: "2026-07-20T00:00:00Z"
  };
  const statuses = [];
  const repository = {
    get: async (id) => id === cached.id ? cached : null,
    getLatest: async () => cached,
    put: async () => {}
  };
  const delivery = new PackDelivery({
    repository,
    fetchImpl: async () => { throw new Error("offline"); },
    onStatusChange: (status) => statuses.push(status)
  });

  const result = await delivery.loadCurrent({ fallbackPackId: cached.id });

  assert.equal(result.delivery, cached);
  assert.equal(result.offline, true);
  assert.deepEqual(statuses, ["checking", "offline"]);
});
