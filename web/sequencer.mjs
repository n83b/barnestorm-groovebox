export const STEPS_PER_PATTERN = 16;
export const STEPS_PER_BEAT = 4;

export function getStepDurationSeconds(tempo, swing, transportTick) {
  const safeTempo = clampNumber(tempo, 40, 240, 120);
  const safeSwing = clampNumber(swing, 0, 60, 0) / 100;
  const straightDuration = 60 / safeTempo / STEPS_PER_BEAT;
  const swingMultiplier = transportTick % 2 === 0 ? 1 + safeSwing : 1 - safeSwing;

  return straightDuration * swingMultiplier;
}

export function getStepEvents(pattern, transportTick, muted = []) {
  if (!pattern?.tracks) return [];

  return pattern.tracks.flatMap((track, trackIndex) => {
    if (muted[trackIndex]) return [];

    const length = clampInteger(track?.length, 1, STEPS_PER_PATTERN, STEPS_PER_PATTERN);
    const stepIndex = Math.max(0, Math.trunc(transportTick)) % length;
    const step = track?.steps?.[stepIndex];

    if (!step?.active) return [];

    return [{
      trackIndex,
      stepIndex,
      note: clampInteger(step.note, 24, 96, 48),
      velocity: clampInteger(step.velocity, 1, 127, 100)
    }];
  });
}

export function getPlaybackRate({ kind, note, rootNote, transpose = 0 }) {
  const noteOffset = kind === "chromatic"
    ? clampNumber(note, 0, 127, rootNote) - clampNumber(rootNote, 0, 127, 48)
    : 0;
  const semitones = noteOffset + clampNumber(transpose, -24, 24, 0);

  return 2 ** (semitones / 12);
}

export function validatePackManifest(pack) {
  if (!pack || typeof pack !== "object") {
    throw new TypeError("The weekly pack manifest must be an object.");
  }

  if (!Array.isArray(pack.tracks) || pack.tracks.length !== 8) {
    throw new TypeError("A weekly pack must contain exactly eight tracks.");
  }

  const ids = new Set();
  const tracks = pack.tracks.map((track, index) => {
    const expectedKind = index < 4 ? "drum" : "chromatic";
    if (!track || typeof track !== "object") {
      throw new TypeError(`Track ${index + 1} must be an object.`);
    }
    if (typeof track.id !== "string" || track.id.length === 0 || ids.has(track.id)) {
      throw new TypeError(`Track ${index + 1} must have a unique id.`);
    }
    if (typeof track.file !== "string" || track.file.length === 0) {
      throw new TypeError(`Track ${index + 1} must reference an audio file.`);
    }
    if (track.kind !== expectedKind) {
      throw new TypeError(`Track ${index + 1} must be ${expectedKind}.`);
    }

    ids.add(track.id);
    return {
      ...track,
      rootNote: expectedKind === "chromatic"
        ? clampInteger(track.rootNote, 0, 127, 48)
        : null
    };
  });

  return {
    id: String(pack.id ?? "weekly-pack"),
    week: clampInteger(pack.week, 1, 53, 1),
    name: String(pack.name ?? "Untitled Pack"),
    license: String(pack.license ?? ""),
    tracks
  };
}

function clampNumber(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(maximum, Math.max(minimum, number))
    : fallback;
}

function clampInteger(value, minimum, maximum, fallback) {
  return Math.round(clampNumber(value, minimum, maximum, fallback));
}
