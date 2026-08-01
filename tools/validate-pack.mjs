import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { validatePackPointer } from "../web/pack-delivery.mjs";
import { validatePackManifest } from "../web/sequencer.mjs";

export const DEFAULT_POINTER_FILE = new URL(
  "../web/assets/packs/current.json",
  import.meta.url
);

export async function validatePublishedPack(pointerSource = DEFAULT_POINTER_FILE) {
  const pointerFile = toFileUrl(pointerSource);
  const pointer = validatePackPointer(
    JSON.parse(await readFile(pointerFile, "utf8")),
    pointerFile
  );
  const manifestFile = new URL(pointer.manifestUrl);
  const manifest = validatePackManifest(
    JSON.parse(await readFile(manifestFile, "utf8"))
  );

  if (manifest.id !== pointer.packId) {
    throw new Error("The current pack pointer and manifest ids do not match.");
  }

  for (const [trackIndex, track] of manifest.tracks.entries()) {
    if (!Number.isInteger(track.byteLength) || track.byteLength <= 0) {
      throw new Error(`Track ${trackIndex + 1} must declare its byte length.`);
    }
    if (!/^[a-f0-9]{64}$/i.test(track.sha256)) {
      throw new Error(`Track ${trackIndex + 1} must declare a SHA-256 hash.`);
    }

    const audio = await readFile(new URL(track.file, manifestFile));
    validateWav(audio, track.name ?? track.id);
    if (audio.byteLength !== track.byteLength) {
      throw new Error(`${track.name ?? track.id} has an unexpected file size.`);
    }
    const hash = createHash("sha256").update(audio).digest("hex");
    if (hash !== track.sha256.toLowerCase()) {
      throw new Error(`${track.name ?? track.id} failed its integrity check.`);
    }
  }

  return { pointer, manifest, pointerFile, manifestFile };
}

export function validateWav(audio, name = "Sample") {
  const riff = audio.subarray(0, 4).toString("ascii");
  const wave = audio.subarray(8, 12).toString("ascii");
  if (audio.byteLength < 44 || !["RIFF", "RF64"].includes(riff) || wave !== "WAVE") {
    throw new Error(`${name} is not a valid WAV file.`);
  }
}

function toFileUrl(source) {
  if (source instanceof URL) return source;
  return pathToFileURL(resolve(String(source)));
}

function isMainModule() {
  return process.argv[1]
    && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
}

if (isMainModule()) {
  const { manifest } = await validatePublishedPack(process.argv[2]);
  process.stdout.write(`Validated ${manifest.id}: 8 samples ready for delivery.\n`);
}
