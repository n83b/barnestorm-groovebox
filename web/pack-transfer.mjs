import { sha256Hex } from "./pack-delivery.mjs?v=dev";
import { restoreState } from "./state.mjs?v=dev";
import { validatePackManifest } from "./sequencer.mjs?v=dev";

export const PACK_PROJECT_FILENAME = "project.json";
export const PACK_MANIFEST_FILENAME = "manifest.json";
export const PACK_TRANSFER_FORMAT = "barnestorm-groovebox-pack";
export const PACK_TRANSFER_SCHEMA_VERSION = 1;
export const PACK_TRANSFER_FILE_EXTENSION = ".wgbpack";
export const PACK_TRANSFER_MIME_TYPE = "application/vnd.barnestorm-groovebox.pack+json";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function createExportDirectoryName(packName, exportedAt = new Date()) {
  const slug = String(packName ?? "pack")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 40) || "pack";
  const timestamp = new Date(exportedAt).toISOString().replace(/[:.]/g, "-");
  return `barnestorm-groovebox-${slug}-${timestamp}`;
}

export async function exportPackToDirectory(parentDirectory, {
  project,
  delivery,
  exportedAt = new Date()
} = {}) {
  if (!parentDirectory?.getDirectoryHandle) {
    throw new TypeError("A writable destination folder is required.");
  }

  const prepared = await preparePackBundle({ project, delivery, exportedAt });
  const directoryName = createExportDirectoryName(prepared.manifest.name, exportedAt);
  const directory = await parentDirectory.getDirectoryHandle(directoryName, { create: true });

  await writeJsonFile(directory, PACK_PROJECT_FILENAME, prepared.projectFile);
  await writeJsonFile(directory, PACK_MANIFEST_FILENAME, prepared.manifest);
  await Promise.all(prepared.samples.map(({ filename, data }) =>
    writeFile(directory, filename, data)
  ));

  return { directoryName, manifest: prepared.manifest };
}

export async function importPackFromDirectory(directory, {
  importedAt = new Date()
} = {}) {
  if (!directory?.getFileHandle) {
    throw new TypeError("A pack folder is required.");
  }

  const projectFile = await readJsonFile(directory, PACK_PROJECT_FILENAME);
  if (
    projectFile?.format !== PACK_TRANSFER_FORMAT
    || projectFile?.schemaVersion !== PACK_TRANSFER_SCHEMA_VERSION
  ) {
    throw new TypeError("This folder is not a supported Barnestörm Groovebox pack.");
  }

  const manifest = await readJsonFile(
    directory,
    projectFile.manifestFile ?? PACK_MANIFEST_FILENAME
  );
  return assembleImportedPack({
    projectFile,
    manifest,
    importedAt,
    readSample: async (track, trackIndex) => {
      const filename = getSampleFilename(track.file, trackIndex);
      const file = await getFile(directory, filename);
      return { contentType: file.type || "audio/wav", data: await file.arrayBuffer() };
    }
  });
}

export async function exportPackToFile({
  project,
  delivery,
  exportedAt = new Date()
} = {}) {
  const prepared = await preparePackBundle({ project, delivery, exportedAt });
  const payload = {
    ...prepared.projectFile,
    manifest: prepared.manifest,
    samples: prepared.samples.map((sample, trackIndex) => ({
      trackId: prepared.manifest.tracks[trackIndex].id,
      filename: sample.filename,
      contentType: delivery.samples.find(
        (candidate) => candidate.trackId === prepared.manifest.tracks[trackIndex].id
      )?.contentType || "audio/wav",
      data: encodeBase64(sample.data)
    }))
  };
  const basename = createExportDirectoryName(prepared.manifest.name, exportedAt);

  return {
    filename: `${basename}${PACK_TRANSFER_FILE_EXTENSION}`,
    blob: new Blob([`${JSON.stringify(payload)}\n`], { type: PACK_TRANSFER_MIME_TYPE }),
    manifest: prepared.manifest
  };
}

export async function importPackFromFile(file, {
  importedAt = new Date()
} = {}) {
  if (!file?.text) throw new TypeError("A Barnestörm Groovebox pack file is required.");

  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    throw new TypeError("The selected pack file is not valid JSON.");
  }

  const samplesByFilename = new Map(
    Array.isArray(payload?.samples)
      ? payload.samples.map((sample) => [sample.filename, sample])
      : []
  );
  return assembleImportedPack({
    projectFile: payload,
    manifest: payload?.manifest,
    importedAt,
    readSample: async (track, trackIndex) => {
      const filename = getSampleFilename(track.file, trackIndex);
      const sample = samplesByFilename.get(filename);
      if (!sample || sample.trackId !== track.id || typeof sample.data !== "string") {
        throw new TypeError(`The pack is missing ${filename}.`);
      }
      return {
        contentType: sample.contentType || "audio/wav",
        data: decodeBase64(sample.data, filename)
      };
    }
  });
}

async function preparePackBundle({ project, delivery, exportedAt }) {
  if (!delivery?.manifest || !Array.isArray(delivery.samples)) {
    throw new TypeError("The active sound pack is not ready to save.");
  }

  const manifest = validatePackManifest(delivery.manifest);
  validateProject(project, manifest.id);
  const restoredProject = restoreState(project);
  const samplesByTrack = new Map(delivery.samples.map((sample) => [sample.trackId, sample]));
  const samples = [];

  for (const [trackIndex, track] of manifest.tracks.entries()) {
    validateTrackIntegrity(track, trackIndex);
    const sample = samplesByTrack.get(track.id);
    if (!sample) {
      throw new TypeError(`The active pack is missing ${track.name ?? track.id}.`);
    }
    const data = toArrayBuffer(sample.data);
    await verifySample(data, track, trackIndex);
    samples.push({
      filename: getSampleFilename(track.file, trackIndex),
      data
    });
  }

  const exportedAtIso = new Date(exportedAt).toISOString();
  return {
    manifest: {
      ...manifest,
      tracks: manifest.tracks.map((track, trackIndex) => ({
        ...track,
        file: `./${samples[trackIndex].filename}`
      }))
    },
    projectFile: {
      format: PACK_TRANSFER_FORMAT,
      schemaVersion: PACK_TRANSFER_SCHEMA_VERSION,
      exportedAt: exportedAtIso,
      manifestFile: PACK_MANIFEST_FILENAME,
      project: restoredProject
    },
    samples
  };
}

function validateProject(project, packId) {
  if (!project || typeof project !== "object" || project.version !== 1) {
    throw new TypeError("The pack contains unsupported pattern data.");
  }
  if (project.packId !== packId) {
    throw new TypeError("The sound pack and pattern data do not belong together.");
  }
  if (!Array.isArray(project.patterns) || project.patterns.length === 0) {
    throw new TypeError("The pack does not contain pattern data.");
  }
}

async function assembleImportedPack({ projectFile, manifest: rawManifest, importedAt, readSample }) {
  if (
    projectFile?.format !== PACK_TRANSFER_FORMAT
    || projectFile?.schemaVersion !== PACK_TRANSFER_SCHEMA_VERSION
  ) {
    throw new TypeError("This is not a supported Barnestörm Groovebox pack.");
  }

  const manifest = validatePackManifest(rawManifest);
  validateProject(projectFile.project, manifest.id);
  const project = restoreState(projectFile.project);
  const samples = [];

  for (const [trackIndex, track] of manifest.tracks.entries()) {
    validateTrackIntegrity(track, trackIndex);
    const sample = await readSample(track, trackIndex);
    const data = toArrayBuffer(sample.data);
    await verifySample(data, track, trackIndex);
    samples.push({
      trackId: track.id,
      contentType: sample.contentType || "audio/wav",
      data
    });
  }

  return {
    project,
    delivery: {
      id: manifest.id,
      manifest,
      samples,
      storedAt: new Date(importedAt).toISOString()
    }
  };
}

function validateTrackIntegrity(track, trackIndex) {
  if (!Number.isInteger(track.byteLength) || track.byteLength <= 0) {
    throw new TypeError(`Track ${trackIndex + 1} has no valid file size.`);
  }
  if (typeof track.sha256 !== "string" || !SHA256_PATTERN.test(track.sha256.toLowerCase())) {
    throw new TypeError(`Track ${trackIndex + 1} has no valid checksum.`);
  }
}

async function verifySample(data, track, trackIndex) {
  if (data.byteLength !== track.byteLength) {
    throw new TypeError(`Track ${trackIndex + 1} has an unexpected file size.`);
  }
  const hash = await sha256Hex(data);
  if (hash.toLowerCase() !== track.sha256.toLowerCase()) {
    throw new TypeError(`Track ${trackIndex + 1} failed its integrity check.`);
  }
}

function getSampleFilename(value, trackIndex) {
  const filename = String(value ?? "").replace(/^\.\//, "");
  if (
    !filename
    || filename.includes("/")
    || filename.includes("\\")
    || filename === "."
    || filename === ".."
  ) {
    throw new TypeError(`Track ${trackIndex + 1} has an unsafe sample filename.`);
  }
  return filename;
}

function toArrayBuffer(value) {
  if (value instanceof ArrayBuffer) return value.slice(0);
  if (ArrayBuffer.isView(value)) {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  }
  throw new TypeError("A pack sample is not binary audio data.");
}

function encodeBase64(value) {
  const bytes = new Uint8Array(toArrayBuffer(value));
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }
  return btoa(binary);
}

function decodeBase64(value, filename) {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes.buffer;
  } catch {
    throw new TypeError(`${filename} contains invalid audio data.`);
  }
}

async function readJsonFile(directory, filename) {
  const file = await getFile(directory, filename);
  try {
    return JSON.parse(await file.text());
  } catch {
    throw new TypeError(`${filename} is not valid JSON.`);
  }
}

async function getFile(directory, filename) {
  try {
    const handle = await directory.getFileHandle(filename);
    return await handle.getFile();
  } catch (error) {
    if (error?.name === "NotFoundError") {
      throw new TypeError(`The pack is missing ${filename}.`);
    }
    throw error;
  }
}

async function writeJsonFile(directory, filename, value) {
  await writeFile(directory, filename, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeFile(directory, filename, value) {
  const handle = await directory.getFileHandle(filename, { create: true });
  const writable = await handle.createWritable();
  try {
    await writable.write(value);
  } finally {
    await writable.close();
  }
}
