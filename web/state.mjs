export const TRACKS = [
  { name: "Kick", kind: "drum", color: "#ff8a00" },
  { name: "Snare", kind: "drum", color: "#ff8a00" },
  { name: "Hi-hat", kind: "drum", color: "#ff8a00" },
  { name: "Perc", kind: "drum", color: "#ff8a00" },
  { name: "Bass", kind: "chromatic", color: "#2f8cff" },
  { name: "Lead", kind: "chromatic", color: "#00d6d1" },
  { name: "Chord", kind: "chromatic", color: "#a933ff" },
  { name: "Texture", kind: "chromatic", color: "#ff2d9d" }
];

export const BANKS = [
  { name: "A", color: "#ff8a00" },
  { name: "B", color: "#2f8cff" },
  { name: "C", color: "#00d6d1" },
  { name: "D", color: "#a933ff" }
];

export const PATTERNS_PER_BANK = 8;

export const FILTER_TYPES = [
  { value: "lowpass", label: "LPF" },
  { value: "highpass", label: "HPF" }
];

export const FX_TYPES = [
  { value: "delay", label: "Delay" },
  { value: "reverb", label: "Reverb" },
  { value: "chorus", label: "Chorus" },
  { value: "distortion", label: "Distortion" }
];

export const PATTERN_NAMES = BANKS.flatMap((bank) =>
  Array.from({ length: PATTERNS_PER_BANK }, (_, index) => `${bank.name}${index + 1}`)
);

export const PARAMETER_DEFINITIONS = [
  { key: "volume", label: "Volume", min: 0, max: 100, step: 1, defaultValue: 78, format: (value) => `${value}%` },
  { key: "pan", label: "Pan", min: -100, max: 100, step: 1, defaultValue: 0, format: formatPan, bipolar: true },
  { key: "pitch", label: "Pitch", min: -24, max: 24, step: 1, defaultValue: 0, format: (value) => `${value > 0 ? "+" : ""}${value} st` },
  { key: "start", label: "Start", min: 0, max: 99, step: 1, defaultValue: 0, format: (value) => `${value}%` },
  { key: "end", label: "End", min: 1, max: 100, step: 1, defaultValue: 100, format: (value) => `${value}%` },
  { key: "filter", label: "Filter", min: 0, max: 100, step: 1, defaultValue: 86, format: (value) => `${value}%` },
  { key: "resonance", label: "Resonance", min: 0, max: 100, step: 1, defaultValue: 18, format: (value) => `${value}%` },
  { key: "fx", label: "FX", min: 0, max: 100, step: 1, defaultValue: 35, format: (value) => `${value}%`, accent: "fx" },
  { key: "fxDepth", label: "FX Depth", min: 0, max: 100, step: 1, defaultValue: 24, format: (value) => `${value}%`, accent: "fx" }
];

const DEFAULT_STEPS = {
  A1: {
    Kick: [0, 4, 8, 12],
    Snare: [4, 12],
    "Hi-hat": [2, 6, 10, 14],
    Perc: [7, 15],
    Bass: [0, 3, 6, 8, 11, 14],
    Lead: [2, 7, 10, 15],
    Chord: [0, 8],
    Texture: [3, 11]
  }
};

export function createInitialState(packId = null, savedTrackRootNotes = []) {
  const trackRootNotes = normalizeTrackRootNotes(savedTrackRootNotes);
  const patterns = PATTERN_NAMES.map((patternName) => ({
    name: patternName,
    tracks: TRACKS.map((track, trackIndex) => {
      const steps = Array.from({ length: 16 }, (_, stepIndex) =>
        createStep(
          trackIndex,
          stepIndex,
          DEFAULT_STEPS[patternName]?.[track.name]?.includes(stepIndex) ?? false,
          trackRootNotes[trackIndex]
        )
      );
      return {
        length: 16,
        parameters: createDefaultTrackParameters(),
        lastAddedNote: track.kind === "chromatic" && steps.some((step) => step.active)
          ? trackRootNotes[trackIndex]
          : null,
        steps
      };
    })
  }));

  return {
    version: 1,
    packId: normalizePackId(packId),
    selectedTrack: 0,
    selectedBank: 0,
    selectedPattern: 0,
    selectedPatternByBank: BANKS.map(() => 0),
    queuedPattern: null,
    tempo: 128,
    swing: 14,
    compressor: 0,
    trackRootNotes,
    muted: TRACKS.map(() => false),
    trackParameters: TRACKS.map(() => createDefaultTrackParameters()),
    patterns
  };
}

export function restoreState(rawState) {
  const fallback = createInitialState(rawState?.packId);

  if (!rawState || rawState.version !== fallback.version) {
    return fallback;
  }

  try {
    const selectedPattern = clampInteger(rawState.selectedPattern, 0, PATTERN_NAMES.length - 1);
    const selectedBank = clampInteger(
      rawState.selectedBank ?? Math.floor(selectedPattern / PATTERNS_PER_BANK),
      0,
      BANKS.length - 1
    );
    const selectedPatternByBank = restoreBankSelections(
      rawState.selectedPatternByBank,
      selectedBank,
      selectedPattern
    );
    const trackParameters = fallback.trackParameters.map((defaults, index) =>
      restoreTrackParameters(rawState.trackParameters?.[index], defaults)
    );
    const trackRootNotes = rawState.trackRootNotes
      ? normalizeTrackRootNotes(rawState.trackRootNotes)
      : TRACKS.map((track, trackIndex) => track.kind === "chromatic" ? 48 + trackIndex : null);

    return {
      ...fallback,
      ...rawState,
      packId: normalizePackId(rawState.packId),
      selectedTrack: clampInteger(rawState.selectedTrack, 0, TRACKS.length - 1),
      selectedBank,
      selectedPattern,
      selectedPatternByBank,
      queuedPattern: rawState.queuedPattern == null
        ? null
        : clampInteger(rawState.queuedPattern, 0, PATTERN_NAMES.length - 1),
      tempo: clampNumber(rawState.tempo, 40, 240),
      swing: clampNumber(rawState.swing, 0, 60),
      compressor: clampNumber(rawState.compressor, 0, 100),
      trackRootNotes,
      muted: fallback.muted.map((defaultValue, index) => Boolean(rawState.muted?.[index] ?? defaultValue)),
      trackParameters,
      patterns: fallback.patterns.map((defaultPattern, patternIndex) => ({
        ...defaultPattern,
        ...(rawState.patterns?.[patternIndex] ?? {}),
        name: defaultPattern.name,
        tracks: defaultPattern.tracks.map((defaultTrack, trackIndex) => {
          const savedTrack = rawState.patterns?.[patternIndex]?.tracks?.[trackIndex];
          const parameters = restoreTrackParameters(
            savedTrack?.parameters,
            trackParameters[trackIndex]
          );
          const steps = defaultTrack.steps.map((defaultStep, stepIndex) => {
            const savedStep = savedTrack?.steps?.[stepIndex];
            const active = Boolean(savedStep?.active ?? defaultStep.active);
            const note = clampInteger(savedStep?.note ?? defaultStep.note, 24, 96);
            const hasNoteData = TRACKS[trackIndex].kind === "chromatic" && Boolean(
              savedStep?.hasNoteData
                ?? (active || note !== trackRootNotes[trackIndex])
            );
            return {
              ...defaultStep,
              ...(savedStep ?? {}),
              active,
              note,
              hasNoteData,
              velocity: clampInteger(savedStep?.velocity ?? defaultStep.velocity, 1, 127),
              automation: restoreStepAutomation(
                savedStep?.automation,
                parameters
              )
            };
          });
          return {
            length: clampInteger(savedTrack?.length ?? defaultTrack.length, 1, 16),
            parameters,
            lastAddedNote: TRACKS[trackIndex].kind === "chromatic"
              ? restoreLastAddedNote(savedTrack?.lastAddedNote, steps)
              : null,
            steps
          };
        })
      }))
    };
  } catch {
    return fallback;
  }
}

function normalizePackId(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function toggleStep(state, stepIndex) {
  const track = getSelectedPatternTrack(state);
  if (stepIndex < 0 || stepIndex >= track.length) return state;

  const step = track.steps[stepIndex];
  if (!step.active && TRACKS[state.selectedTrack].kind === "chromatic") {
    const sequenceHasNoteData = track.steps.some((candidate) =>
      candidate.active && candidate.hasNoteData
    );
    if (!step.hasNoteData) {
      step.note = sequenceHasNoteData
        ? track.lastAddedNote ?? getLastActiveNote(track.steps) ?? state.trackRootNotes[state.selectedTrack]
        : state.trackRootNotes[state.selectedTrack];
      step.hasNoteData = true;
    }
    track.lastAddedNote = step.note;
  }

  step.active = !step.active;
  return state;
}

export function setStepNote(state, stepIndex, note) {
  if (TRACKS[state.selectedTrack].kind !== "chromatic") return state;

  const track = getSelectedPatternTrack(state);
  const safeStepIndex = clampInteger(stepIndex, 0, track.length - 1);
  const step = track.steps[safeStepIndex];
  step.note = clampInteger(note, 24, 96);
  step.hasNoteData = true;
  track.lastAddedNote = step.note;
  return state;
}

export function setTrackLength(state, stepIndex) {
  getSelectedPatternTrack(state).length = clampInteger(stepIndex + 1, 1, 16);
  return state;
}

export function getTrackPlayhead(transportTick, trackLength) {
  const tick = Math.max(0, Math.trunc(Number(transportTick) || 0));
  const length = clampInteger(trackLength, 1, 16);
  return tick % length;
}

export function selectPattern(state, patternIndex, isPlaying) {
  const nextPattern = clampInteger(patternIndex, 0, PATTERN_NAMES.length - 1);
  const patternBank = Math.floor(nextPattern / PATTERNS_PER_BANK);
  const patternSlot = nextPattern % PATTERNS_PER_BANK;

  state.selectedPatternByBank[patternBank] = patternSlot;

  if (isPlaying && nextPattern !== state.selectedPattern) {
    state.queuedPattern = nextPattern;
  } else {
    state.selectedPattern = nextPattern;
    state.queuedPattern = null;
  }

  return state;
}

export function selectBank(state, bankIndex) {
  state.selectedBank = clampInteger(bankIndex, 0, BANKS.length - 1);
  return state;
}

export function commitQueuedPattern(state, scheduledPattern = state.queuedPattern) {
  if (scheduledPattern != null) {
    state.selectedPattern = clampInteger(scheduledPattern, 0, PATTERN_NAMES.length - 1);
    const patternBank = Math.floor(state.selectedPattern / PATTERNS_PER_BANK);
    state.selectedPatternByBank[patternBank] = state.selectedPattern % PATTERNS_PER_BANK;
    if (state.queuedPattern === state.selectedPattern) {
      state.queuedPattern = null;
    }
  }
  return state;
}

export function setParameter(state, key, value) {
  const definition = PARAMETER_DEFINITIONS.find((parameter) => parameter.key === key);
  if (!definition) return state;

  let nextValue = clampNumber(value, definition.min, definition.max);
  const parameters = getSelectedPatternTrack(state).parameters;

  if (key === "start") nextValue = Math.min(nextValue, parameters.end - 1);
  if (key === "end") nextValue = Math.max(nextValue, parameters.start + 1);

  parameters[key] = nextValue;
  return state;
}

export function setTrackMode(state, key, value) {
  const options = key === "filterType"
    ? FILTER_TYPES
    : key === "fxType"
      ? FX_TYPES
      : null;
  if (!options) return state;

  getSelectedPatternTrack(state).parameters[key] = normalizeOption(
    value,
    options,
    options[0].value
  );
  return state;
}

export function setStepAutomation(state, stepIndex, key, value) {
  const definition = PARAMETER_DEFINITIONS.find((parameter) => parameter.key === key);
  if (!definition) return state;

  const patternTrack = getSelectedPatternTrack(state);
  const safeStepIndex = clampInteger(stepIndex, 0, patternTrack.length - 1);
  const step = patternTrack.steps[safeStepIndex];
  const automation = {
    ...step.automation,
    [key]: clampNumber(value, definition.min, definition.max)
  };

  step.automation = restoreStepAutomation(
    automation,
    getPatternTrackParameters(state, state.selectedPattern, state.selectedTrack)
  );
  return state;
}

export function getPatternTrackParameters(
  state,
  patternIndex = state.selectedPattern,
  trackIndex = state.selectedTrack
) {
  const safePatternIndex = clampInteger(patternIndex, 0, state.patterns.length - 1);
  const safeTrackIndex = clampInteger(trackIndex, 0, TRACKS.length - 1);
  const patternTrack = state.patterns[safePatternIndex].tracks[safeTrackIndex];
  return restoreTrackParameters(
    patternTrack.parameters,
    state.trackParameters[safeTrackIndex]
  );
}

export function getAutomatedTrackParameters(
  state,
  patternIndex,
  trackIndex,
  stepIndex
) {
  const safePatternIndex = clampInteger(patternIndex, 0, state.patterns.length - 1);
  const safeTrackIndex = clampInteger(trackIndex, 0, TRACKS.length - 1);
  const patternTrack = state.patterns[safePatternIndex].tracks[safeTrackIndex];
  const safeStepIndex = clampInteger(stepIndex, 0, patternTrack.length - 1);
  const patternParameters = getPatternTrackParameters(
    state,
    safePatternIndex,
    safeTrackIndex
  );

  return {
    ...patternParameters,
    ...restoreStepAutomation(
      patternTrack.steps[safeStepIndex].automation,
      patternParameters
    )
  };
}

export function hasTrackAutomation(
  state,
  key,
  patternIndex = state.selectedPattern,
  trackIndex = state.selectedTrack
) {
  if (!PARAMETER_DEFINITIONS.some((parameter) => parameter.key === key)) return false;

  const safePatternIndex = clampInteger(patternIndex, 0, state.patterns.length - 1);
  const safeTrackIndex = clampInteger(trackIndex, 0, TRACKS.length - 1);
  return state.patterns[safePatternIndex].tracks[safeTrackIndex].steps.some((step) =>
    Object.prototype.hasOwnProperty.call(step.automation ?? {}, key)
  );
}

export function clearTrackAutomation(
  state,
  key,
  patternIndex = state.selectedPattern,
  trackIndex = state.selectedTrack
) {
  if (!PARAMETER_DEFINITIONS.some((parameter) => parameter.key === key)) return state;

  const safePatternIndex = clampInteger(patternIndex, 0, state.patterns.length - 1);
  const safeTrackIndex = clampInteger(trackIndex, 0, TRACKS.length - 1);
  const patternTrack = state.patterns[safePatternIndex].tracks[safeTrackIndex];

  patternTrack.steps.forEach((step) => {
    if (!Object.prototype.hasOwnProperty.call(step.automation ?? {}, key)) return;
    const { [key]: removedValue, ...remainingAutomation } = step.automation;
    step.automation = remainingAutomation;
  });
  return state;
}

export function clearTrackSequence(
  state,
  patternIndex = state.selectedPattern,
  trackIndex = state.selectedTrack
) {
  const safePatternIndex = clampInteger(patternIndex, 0, state.patterns.length - 1);
  const safeTrackIndex = clampInteger(trackIndex, 0, TRACKS.length - 1);
  const patternTrack = state.patterns[safePatternIndex].tracks[safeTrackIndex];

  patternTrack.steps = Array.from({ length: 16 }, (_, stepIndex) =>
    createStep(safeTrackIndex, stepIndex, false, state.trackRootNotes?.[safeTrackIndex])
  );
  patternTrack.lastAddedNote = null;
  return state;
}

export function applyPackRootNotes(state, manifestTracks) {
  const nextRootNotes = normalizeTrackRootNotes(
    TRACKS.map((_, trackIndex) => manifestTracks?.[trackIndex]?.rootNote)
  );
  const previousRootNotes = state.trackRootNotes ??
    TRACKS.map((track, trackIndex) => track.kind === "chromatic" ? 48 + trackIndex : null);

  TRACKS.forEach((track, trackIndex) => {
    if (track.kind !== "chromatic") return;

    const previousRootNote = clampInteger(previousRootNotes[trackIndex], 24, 96);
    const nextRootNote = nextRootNotes[trackIndex];
    if (previousRootNote === nextRootNote) return;

    state.patterns.forEach((pattern) => {
      const patternTrack = pattern.tracks[trackIndex];
      patternTrack.steps.forEach((step) => {
        if (step.note === previousRootNote) step.note = nextRootNote;
      });
      if (patternTrack.lastAddedNote === previousRootNote) {
        patternTrack.lastAddedNote = nextRootNote;
      }
    });
  });

  state.trackRootNotes = nextRootNotes;
  return state;
}

export function clearPatternSequence(state, patternIndex = state.selectedPattern) {
  const safePatternIndex = clampInteger(patternIndex, 0, state.patterns.length - 1);
  TRACKS.forEach((_, trackIndex) => {
    clearTrackSequence(state, safePatternIndex, trackIndex);
  });
  return state;
}

export function hasPatternData(state, patternIndex = state.selectedPattern) {
  const safePatternIndex = clampInteger(patternIndex, 0, state.patterns.length - 1);
  return state.patterns[safePatternIndex].tracks.some((track) =>
    track.steps.some((step) => step.active)
  );
}

export function copyPattern(state, sourcePatternIndex, destinationPatternIndex) {
  const safeSourceIndex = clampInteger(sourcePatternIndex, 0, state.patterns.length - 1);
  const safeDestinationIndex = clampInteger(destinationPatternIndex, 0, state.patterns.length - 1);
  const sourcePattern = state.patterns[safeSourceIndex];
  const destinationPattern = state.patterns[safeDestinationIndex];

  destinationPattern.tracks = sourcePattern.tracks.map((track) => ({
    ...track,
    parameters: { ...track.parameters },
    steps: track.steps.map((step) => ({
      ...step,
      automation: { ...(step.automation ?? {}) }
    }))
  }));
  return state;
}

export function getSelectedPatternTrack(state) {
  return state.patterns[state.selectedPattern].tracks[state.selectedTrack];
}

export function formatNote(midiNote) {
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${noteNames[midiNote % 12]}${Math.floor(midiNote / 12) - 1}`;
}

function createStep(trackIndex, stepIndex, active = false, rootNote = 48) {
  return {
    active,
    note: TRACKS[trackIndex].kind === "chromatic"
      ? clampInteger(rootNote, 24, 96)
      : 48,
    hasNoteData: TRACKS[trackIndex].kind === "chromatic" && active,
    velocity: stepIndex % 4 === 0 ? 112 : 92,
    automation: {}
  };
}

function restoreLastAddedNote(savedNote, steps) {
  if (savedNote != null && savedNote !== "" && Number.isFinite(Number(savedNote))) {
    return clampInteger(savedNote, 24, 96);
  }
  return getLastActiveNote(steps);
}

function getLastActiveNote(steps) {
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    if (steps[index].active && steps[index].hasNoteData) return steps[index].note;
  }
  return null;
}

function normalizeTrackRootNotes(savedTrackRootNotes) {
  return TRACKS.map((track, trackIndex) => track.kind === "chromatic"
    ? clampInteger(savedTrackRootNotes?.[trackIndex] ?? 48, 24, 96)
    : null
  );
}

function formatPan(value) {
  if (value === 0) return "C";
  return value < 0 ? `L${Math.abs(value)}` : `R${value}`;
}

function restoreTrackParameters(savedParameters, defaults) {
  const restored = Object.fromEntries(
    PARAMETER_DEFINITIONS.map((definition) => [
      definition.key,
      clampNumber(
        savedParameters?.[definition.key] ?? defaults[definition.key],
        definition.min,
        definition.max
      )
    ])
  );

  if (restored.start >= restored.end) {
    restored.start = Math.max(0, restored.end - 1);
  }

  restored.filterType = normalizeOption(
    savedParameters?.filterType ?? defaults.filterType,
    FILTER_TYPES,
    "lowpass"
  );
  restored.fxType = normalizeOption(
    savedParameters?.fxType ?? defaults.fxType,
    FX_TYPES,
    "delay"
  );

  return restored;
}

function createDefaultTrackParameters() {
  return {
    ...Object.fromEntries(
      PARAMETER_DEFINITIONS.map((parameter) => [parameter.key, parameter.defaultValue])
    ),
    filterType: "lowpass",
    fxType: "delay"
  };
}

function normalizeOption(value, options, fallback) {
  return options.some((option) => option.value === value) ? value : fallback;
}

function restoreStepAutomation(savedAutomation, baseParameters) {
  if (!savedAutomation || typeof savedAutomation !== "object") return {};

  const automation = Object.fromEntries(
    PARAMETER_DEFINITIONS
      .filter((definition) =>
        Object.prototype.hasOwnProperty.call(savedAutomation, definition.key)
      )
      .map((definition) => [
        definition.key,
        clampNumber(
          savedAutomation[definition.key],
          definition.min,
          definition.max
        )
      ])
  );
  const resolved = { ...baseParameters, ...automation };

  if (resolved.start >= resolved.end) {
    if ("start" in automation && !("end" in automation)) {
      automation.start = Math.max(0, resolved.end - 1);
    } else {
      automation.end = Math.min(100, resolved.start + 1);
      if (automation.end <= resolved.start) {
        automation.start = Math.max(0, resolved.end - 1);
      }
    }
  }

  return automation;
}

function restoreBankSelections(savedSelections, selectedBank, selectedPattern) {
  const restored = BANKS.map((_, bankIndex) =>
    clampInteger(savedSelections?.[bankIndex] ?? 0, 0, PATTERNS_PER_BANK - 1)
  );

  if (!Array.isArray(savedSelections)) {
    restored[selectedBank] = selectedPattern % PATTERNS_PER_BANK;
  }

  return restored;
}

function clampNumber(value, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : minimum;
}

function clampInteger(value, minimum, maximum) {
  return Math.round(clampNumber(value, minimum, maximum));
}
