import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DEFAULT_POINTER_FILE, validatePublishedPack, validateWav } from "./validate-pack.mjs";

const PACKS_DIRECTORY = fileURLToPath(new URL("../web/assets/packs/", import.meta.url));
const PACK_NAME_PATTERN = /^(\d{4})-week-(\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const TRACKS = [
  { id: "kick", name: "Kick", kind: "drum", file: "kick.wav" },
  { id: "snare", name: "Snare", kind: "drum", file: "snare.wav" },
  { id: "hi-hat", name: "Hi-hat", kind: "drum", file: "hi-hat.wav" },
  { id: "perc", name: "Perc", kind: "drum", file: "perc.wav" },
  { id: "bass", name: "Bass", kind: "chromatic", file: "bass.wav" },
  { id: "lead", name: "Lead", kind: "chromatic", file: "lead.wav" },
  { id: "chord", name: "Chord", kind: "chromatic", file: "chord.wav" },
  { id: "texture", name: "Texture", kind: "chromatic", file: "texture.wav" }
];

export function parsePackDirectoryName(directoryName) {
  const match = PACK_NAME_PATTERN.exec(directoryName);
  if (!match) {
    throw new Error(
      "Pack folders must use the format YYYY-week-WW-pack-name, for example 2026-week-32-found-signals."
    );
  }

  const year = Number(match[1]);
  const week = Number(match[2]);
  const slug = match[3];
  const { releasedAt, expiresAt } = getIsoWeekWindow(year, week);
  return {
    id: directoryName,
    year,
    week,
    name: slug.split("-").map(titleCase).join(" "),
    releasedAt,
    expiresAt
  };
}

export function getIsoWeekWindow(year, week) {
  if (!Number.isInteger(year) || year < 2020 || year > 9999) {
    throw new Error("Pack year must be between 2020 and 9999.");
  }
  if (!Number.isInteger(week) || week < 1 || week > 53) {
    throw new Error("Pack week must be between 01 and 53.");
  }

  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const januaryFourthDay = januaryFourth.getUTCDay() || 7;
  const firstMonday = new Date(januaryFourth);
  firstMonday.setUTCDate(januaryFourth.getUTCDate() - januaryFourthDay + 1);
  const release = new Date(firstMonday);
  release.setUTCDate(firstMonday.getUTCDate() + (week - 1) * 7);

  if (getIsoWeekYear(release) !== year) {
    throw new Error(`${year} does not contain ISO week ${String(week).padStart(2, "0")}.`);
  }

  const expiry = new Date(release);
  expiry.setUTCDate(release.getUTCDate() + 7);
  return {
    releasedAt: release.toISOString(),
    expiresAt: expiry.toISOString()
  };
}

export async function createPack({
  packDirectory,
  pointerFile = DEFAULT_POINTER_FILE,
  name,
  license = "All rights reserved",
  rootNote = 48,
  packWeek
}) {
  const directory = resolvePackDirectory(packDirectory);
  const metadata = parsePackDirectoryName(basename(directory));
  const pointerPath = pointerFile instanceof URL ? fileURLToPath(pointerFile) : resolve(pointerFile);
  const manifestPath = resolve(directory, "manifest.json");
  const displayWeek = await resolvePackWeek({
    explicitWeek: packWeek,
    manifestPath,
    packId: metadata.id,
    pointerPath
  });
  const safeRootNote = Number(rootNote);
  if (!Number.isInteger(safeRootNote) || safeRootNote < 0 || safeRootNote > 127) {
    throw new Error("Chromatic root note must be a MIDI value from 0 to 127.");
  }

  const tracks = [];
  for (const definition of TRACKS) {
    const audio = await readFile(resolve(directory, definition.file)).catch((error) => {
      if (error?.code === "ENOENT") {
        throw new Error(`Missing required sample: ${definition.file}`);
      }
      throw error;
    });
    validateWav(audio, definition.name);
    tracks.push({
      id: definition.id,
      name: definition.name,
      kind: definition.kind,
      ...(definition.kind === "chromatic" ? { rootNote: safeRootNote } : {}),
      file: `./${definition.file}`,
      byteLength: audio.byteLength,
      sha256: createHash("sha256").update(audio).digest("hex")
    });
  }

  const manifest = {
    schemaVersion: 1,
    id: metadata.id,
    year: metadata.year,
    calendarWeek: metadata.week,
    week: displayWeek,
    name: name || metadata.name,
    license,
    tracks
  };
  const manifestUrl = relative(dirname(pointerPath), manifestPath).split(sep).join("/");
  const pointer = {
    schemaVersion: 1,
    packId: metadata.id,
    manifestUrl: manifestUrl.startsWith(".") ? manifestUrl : `./${manifestUrl}`,
    releasedAt: metadata.releasedAt,
    expiresAt: metadata.expiresAt
  };

  await writeJsonAtomic(manifestPath, manifest);
  await writeJsonAtomic(pointerPath, pointer);
  await validatePublishedPack(pathToFileURL(pointerPath));
  return { directory, manifestPath, pointerPath, manifest, pointer };
}

async function resolvePackWeek({ explicitWeek, manifestPath, packId, pointerPath }) {
  if (explicitWeek != null) return validatePackWeek(explicitWeek);

  const existingManifest = await readJson(manifestPath);
  if (existingManifest?.id === packId && existingManifest.week != null) {
    return validatePackWeek(existingManifest.week);
  }

  const pointer = await readJson(pointerPath);
  if (pointer?.manifestUrl) {
    const pointerUrl = pathToFileURL(pointerPath);
    const currentManifest = await readJson(new URL(pointer.manifestUrl, pointerUrl));
    if (currentManifest?.id === packId && currentManifest.week != null) {
      return validatePackWeek(currentManifest.week);
    }
    if (currentManifest?.week != null) {
      return validatePackWeek(Number(currentManifest.week) + 1);
    }
  }

  return 1;
}

function validatePackWeek(value) {
  const week = Number(value);
  if (!Number.isInteger(week) || week < 1 || week > 9999) {
    throw new Error("Product pack week must be an integer from 1 to 9999.");
  }
  return week;
}

async function readJson(filename) {
  try {
    return JSON.parse(await readFile(filename, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function resolvePackDirectory(source) {
  if (!source) {
    throw new Error(
      "Provide a pack folder, for example: npm run create:pack -- 2026-week-32-found-signals"
    );
  }
  return source === basename(source)
    ? resolve(PACKS_DIRECTORY, source)
    : resolve(source);
}

async function writeJsonAtomic(filename, value) {
  const temporaryFile = `${filename}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryFile, filename);
}

function getIsoWeekYear(date) {
  const thursday = new Date(date);
  const day = thursday.getUTCDay() || 7;
  thursday.setUTCDate(thursday.getUTCDate() + 4 - day);
  return thursday.getUTCFullYear();
}

function titleCase(value) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function parseArguments(argumentsList) {
  const options = {};
  const positional = [];
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (!argument.startsWith("--")) {
      positional.push(argument);
      continue;
    }

    const [flag, inlineValue] = argument.split("=", 2);
    const value = inlineValue ?? argumentsList[++index];
    if (value == null || value.startsWith("--")) {
      throw new Error(`${flag} requires a value.`);
    }
    if (flag === "--name") options.name = value;
    else if (flag === "--license") options.license = value;
    else if (flag === "--root-note") options.rootNote = Number(value);
    else if (flag === "--pack-week") options.packWeek = Number(value);
    else throw new Error(`Unknown option: ${flag}`);
  }
  if (positional.length > 1) {
    throw new Error("Provide exactly one pack folder.");
  }
  return { packDirectory: positional[0], ...options };
}

function isMainModule() {
  return process.argv[1]
    && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
}

if (isMainModule()) {
  const result = await createPack(parseArguments(process.argv.slice(2)));
  process.stdout.write(
    `Created ${result.manifest.id}: manifest.json and current.json are ready.\n`
  );
}
