import test from "node:test";
import assert from "node:assert/strict";
import {
  BANKS,
  FILTER_TYPES,
  FX_TYPES,
  PARAMETER_DEFINITIONS,
  PATTERN_NAMES,
  TRACKS,
  applyPackRootNotes,
  clearPatternSequence,
  clearTrackAutomation,
  clearTrackSequence,
  commitQueuedPattern,
  copyPattern,
  createInitialState,
  formatNote,
  getAutomatedTrackParameters,
  getPatternTrackParameters,
  getTrackPlayhead,
  hasPatternData,
  hasTrackAutomation,
  restoreState,
  selectBank,
  selectPattern,
  setParameter,
  setStepNote,
  setStepAutomation,
  setTrackMode,
  setTrackLength,
  toggleStep
} from "../web/state.mjs";

test("defines Pan as a centered bipolar control", () => {
  const pan = PARAMETER_DEFINITIONS.find((parameter) => parameter.key === "pan");

  assert.equal(pan.bipolar, true);
  assert.equal(pan.min, -pan.max);
  assert.equal(pan.defaultValue, 0);
});

test("shows the Filter value as a percentage", () => {
  const filter = PARAMETER_DEFINITIONS.find((parameter) => parameter.key === "filter");

  assert.equal(filter.sublabel, undefined);
  assert.equal(filter.format(filter.defaultValue), "86%");
});

test("formats chromatic MIDI notes for step labels", () => {
  assert.equal(formatNote(45), "A2");
  assert.equal(formatNote(49), "C#3");
});

test("uses one shared orange accent for all four drum tracks", () => {
  assert.deepEqual(
    TRACKS.slice(0, 4).map((track) => track.color),
    ["#ff8a00", "#ff8a00", "#ff8a00", "#ff8a00"]
  );
});

test("creates thirty-two patterns with eight independent sixteen-step tracks", () => {
  const state = createInitialState("test-pack");

  assert.equal(state.packId, "test-pack");
  assert.equal(state.patterns.length, 32);
  assert.equal(state.patterns[0].tracks.length, 8);
  assert.equal(state.patterns[0].tracks[0].steps.length, 16);
  assert.equal(state.patterns[0].tracks[0].parameters.volume, 78);
  assert.deepEqual(state.patterns[0].tracks[0].steps[0].automation, {});
  assert.notEqual(state.patterns[0].tracks[0], state.patterns[1].tracks[0]);
  assert.notEqual(state.patterns[0].tracks[0].parameters, state.patterns[1].tracks[0].parameters);
});

test("uses each chromatic sample root note for fresh and cleared steps", () => {
  const rootNotes = [null, null, null, null, 60, 61, 62, 63];
  const state = createInitialState("test-pack", rootNotes);

  assert.deepEqual(
    state.patterns[1].tracks.slice(4).map((track) => track.steps[0].note),
    [60, 61, 62, 63]
  );

  clearTrackSequence(state, 1, 4);
  assert.equal(state.patterns[1].tracks[4].steps.every((step) => step.note === 60), true);
  assert.equal(state.patterns[1].tracks[4].steps.every((step) => !step.hasNoteData), true);
  assert.equal(state.patterns[1].tracks[4].lastAddedNote, null);
  assert.equal(restoreState(structuredClone(state)).patterns[1].tracks[4].lastAddedNote, null);
});

test("new chromatic steps inherit the previous entered note unless the sequence is empty", () => {
  const state = createInitialState("test-pack", [null, null, null, null, 48, 48, 48, 48]);
  state.selectedPattern = 1;
  state.selectedTrack = 4;
  const track = state.patterns[1].tracks[4];

  toggleStep(state, 2);
  assert.equal(track.steps[2].note, 48);
  setStepNote(state, 2, 57);

  toggleStep(state, 7);
  assert.equal(track.steps[7].note, 57);
  setStepNote(state, 7, 62);
  toggleStep(state, 7);

  toggleStep(state, 5);
  assert.equal(track.steps[5].note, 62);
  toggleStep(state, 5);

  setStepNote(state, 2, 55);
  toggleStep(state, 7);
  assert.equal(track.steps[7].note, 62);

  toggleStep(state, 7);
  toggleStep(state, 2);
  toggleStep(state, 10);
  assert.equal(track.steps[10].note, 48);
});

test("migrates legacy default notes to pack roots without changing edited notes", () => {
  const legacy = createInitialState("test-pack");
  delete legacy.trackRootNotes;
  legacy.patterns.forEach((pattern) => {
    pattern.tracks.forEach((track, trackIndex) => {
      track.steps.forEach((step) => {
        step.note = 48 + trackIndex;
      });
    });
  });
  legacy.patterns[0].tracks[4].steps[1].note = 60;
  const state = restoreState(legacy);
  const manifestTracks = TRACKS.map((track) => ({
    kind: track.kind,
    rootNote: track.kind === "chromatic" ? 48 : null
  }));

  applyPackRootNotes(state, manifestTracks);

  assert.deepEqual(
    state.patterns[1].tracks.slice(4).map((track) => track.steps[0].note),
    [48, 48, 48, 48]
  );
  assert.equal(state.patterns[0].tracks[4].steps[1].note, 60);
});

test("restores the immutable pack reference with a saved project", () => {
  const state = createInitialState("2026-week-31-test");
  const restored = restoreState(structuredClone(state));

  assert.equal(restored.packId, "2026-week-31-test");
});

test("records independent per-step automation without changing the pattern knob position", () => {
  const state = createInitialState();
  state.selectedTrack = 4;

  setStepAutomation(state, 3, "filter", 24);

  assert.equal(state.trackParameters[4].filter, 86);
  assert.equal(state.patterns[0].tracks[4].parameters.filter, 86);
  assert.equal(state.patterns[0].tracks[4].steps[3].automation.filter, 24);
  assert.equal(
    getAutomatedTrackParameters(state, 0, 4, 3).filter,
    24
  );
  assert.deepEqual(state.patterns[1].tracks[4].steps[3].automation, {});
});

test("stores independent knob positions for each pattern and track", () => {
  const state = createInitialState();
  state.selectedTrack = 4;

  setParameter(state, "filter", 52);

  assert.equal(state.trackParameters[4].filter, 86);
  assert.equal(getPatternTrackParameters(state, 0, 4).filter, 52);
  assert.equal(getAutomatedTrackParameters(state, 0, 4, 7).filter, 52);
  assert.equal(getPatternTrackParameters(state, 1, 4).filter, 86);
  assert.equal(hasTrackAutomation(state, "filter"), false);
});

test("stores filter and effect selections independently per pattern and track", () => {
  const state = createInitialState();
  state.selectedTrack = 4;

  setTrackMode(state, "filterType", "highpass");
  setTrackMode(state, "fxType", "chorus");

  assert.deepEqual(FILTER_TYPES.map((option) => option.label), ["LPF", "HPF"]);
  assert.deepEqual(
    FX_TYPES.map((option) => option.label),
    ["Delay", "Reverb", "Chorus", "Distortion"]
  );
  assert.equal(getPatternTrackParameters(state, 0, 4).filterType, "highpass");
  assert.equal(getPatternTrackParameters(state, 0, 4).fxType, "chorus");
  assert.equal(getPatternTrackParameters(state, 1, 4).filterType, "lowpass");
  assert.equal(getPatternTrackParameters(state, 1, 4).fxType, "delay");
  assert.equal(getPatternTrackParameters(state, 0, 5).filterType, "lowpass");
  assert.equal(getPatternTrackParameters(state, 0, 5).fxType, "delay");

  const restored = restoreState(structuredClone(state));
  assert.equal(getPatternTrackParameters(restored, 0, 4).filterType, "highpass");
  assert.equal(getPatternTrackParameters(restored, 0, 4).fxType, "chorus");
});

test("keeps automated sample bounds valid and restores only known parameters", () => {
  const state = createInitialState();
  setStepAutomation(state, 2, "start", 99);
  setStepAutomation(state, 2, "end", 1);

  assert.deepEqual(
    getAutomatedTrackParameters(state, 0, 0, 2),
    {
      ...state.trackParameters[0],
      start: 99,
      end: 100
    }
  );

  const raw = structuredClone(state);
  raw.patterns[0].tracks[0].steps[2].automation = {
    pan: 999,
    unknown: 42
  };
  const restored = restoreState(raw);

  assert.deepEqual(
    restored.patterns[0].tracks[0].steps[2].automation,
    { pan: 100 }
  );
});

test("detects and clears one knob's automation only in the selected pattern and track", () => {
  const state = createInitialState();
  state.selectedTrack = 4;
  setStepAutomation(state, 1, "filter", 20);
  setStepAutomation(state, 7, "filter", 60);
  setStepAutomation(state, 1, "pan", -30);

  state.selectedPattern = 1;
  setStepAutomation(state, 1, "filter", 45);
  state.selectedPattern = 0;

  assert.equal(hasTrackAutomation(state, "filter"), true);
  clearTrackAutomation(state, "filter");

  assert.equal(hasTrackAutomation(state, "filter"), false);
  assert.equal(hasTrackAutomation(state, "pan"), true);
  assert.equal(hasTrackAutomation(state, "filter", 1, 4), true);
});

test("clears one track sequence without changing its length, knobs or other tracks", () => {
  const state = createInitialState();
  const patternTrack = state.patterns[0].tracks[4];
  const otherTrackWasActive = state.patterns[0].tracks[0].steps[0].active;
  state.patterns[1].tracks[4].steps[3].active = true;

  patternTrack.length = 10;
  patternTrack.parameters.filter = 52;
  patternTrack.steps[3] = {
    active: true,
    note: 63,
    velocity: 127,
    automation: { filter: 20 }
  };

  clearTrackSequence(state, 0, 4);

  assert.equal(patternTrack.steps.every((step) => !step.active), true);
  assert.equal(patternTrack.steps[3].note, 48);
  assert.equal(patternTrack.steps[3].velocity, 92);
  assert.deepEqual(patternTrack.steps[3].automation, {});
  assert.equal(patternTrack.length, 10);
  assert.equal(patternTrack.parameters.filter, 52);
  assert.equal(state.patterns[0].tracks[0].steps[0].active, otherTrackWasActive);
  assert.equal(state.patterns[1].tracks[4].steps[3].active, true);
});

test("clears all eight sequences in one pattern without changing another pattern", () => {
  const state = createInitialState();
  state.patterns[0].tracks[2].length = 7;
  state.patterns[0].tracks[2].parameters.pan = -24;
  state.patterns[1].tracks[0].steps[2].active = true;

  clearPatternSequence(state, 0);

  assert.equal(
    state.patterns[0].tracks.every((track) => track.steps.every((step) => !step.active)),
    true
  );
  assert.equal(state.patterns[0].tracks[2].length, 7);
  assert.equal(state.patterns[0].tracks[2].parameters.pan, -24);
  assert.equal(state.patterns[1].tracks[0].steps[2].active, true);
});

test("reports pattern data from active steps and empty state after clearing", () => {
  const state = createInitialState();

  assert.equal(hasPatternData(state, 0), true);
  assert.equal(hasPatternData(state, 1), false);

  state.patterns[1].tracks[6].steps[4].active = true;
  assert.equal(hasPatternData(state, 1), true);

  clearPatternSequence(state, 1);
  assert.equal(hasPatternData(state, 1), false);
});

test("copies complete pattern state without sharing mutable track data", () => {
  const state = createInitialState();
  const source = state.patterns[0];
  const destinationName = state.patterns[1].name;

  source.tracks[4].length = 10;
  source.tracks[4].parameters.filter = 42;
  source.tracks[4].steps[3] = {
    active: true,
    note: 61,
    velocity: 118,
    automation: { pan: -35 }
  };

  copyPattern(state, 0, 1);

  assert.equal(state.patterns[1].name, destinationName);
  assert.deepEqual(state.patterns[1].tracks, source.tracks);
  assert.notEqual(state.patterns[1].tracks[4], source.tracks[4]);
  assert.notEqual(state.patterns[1].tracks[4].parameters, source.tracks[4].parameters);
  assert.notEqual(state.patterns[1].tracks[4].steps[3], source.tracks[4].steps[3]);
  assert.notEqual(
    state.patterns[1].tracks[4].steps[3].automation,
    source.tracks[4].steps[3].automation
  );

  source.tracks[4].steps[3].note = 72;
  assert.equal(state.patterns[1].tracks[4].steps[3].note, 61);
});

test("creates four color-coded banks with eight numbered patterns each", () => {
  assert.deepEqual(BANKS.map((bank) => bank.color), ["#ff8a00", "#2f8cff", "#00d6d1", "#a933ff"]);
  assert.deepEqual(PATTERN_NAMES.slice(0, 8), ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"]);
  assert.deepEqual(PATTERN_NAMES.slice(8, 16), ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8"]);
});

test("browsing banks does not select or queue a pattern", () => {
  const state = createInitialState();
  selectPattern(state, 5, false);
  selectBank(state, 1);

  assert.equal(state.selectedBank, 1);
  assert.equal(state.selectedPattern, 5);
  assert.equal(state.queuedPattern, null);

  selectBank(state, 2);

  assert.equal(state.selectedBank, 2);
  assert.equal(state.selectedPattern, 5);
  assert.equal(state.queuedPattern, null);

  selectPattern(state, 18, true);

  assert.equal(state.selectedPattern, 5);
  assert.equal(state.queuedPattern, 18);

  selectBank(state, 3);
  commitQueuedPattern(state);

  assert.equal(state.selectedBank, 3);
  assert.equal(state.selectedPattern, 18);
  assert.equal(state.queuedPattern, null);
});

test("expands legacy eight-pattern projects into bank A without losing step data", () => {
  const legacy = createInitialState();
  legacy.patterns = legacy.patterns.slice(0, 8);
  legacy.patterns.forEach((pattern, index) => {
    pattern.name = String.fromCharCode(65 + index);
  });
  legacy.patterns[7].tracks[0].steps[3].active = true;
  delete legacy.selectedBank;

  const restored = restoreState(legacy);

  assert.equal(restored.patterns.length, 32);
  assert.equal(restored.patterns[7].name, "A8");
  assert.equal(restored.patterns[7].tracks[0].steps[3].active, true);
  assert.equal(restored.patterns[8].name, "B1");
  assert.deepEqual(restored.selectedPatternByBank, [0, 0, 0, 0]);
});

test("toggles steps only inside the selected track length", () => {
  const state = createInitialState();
  setTrackLength(state, 7);

  const disabledStepWasActive = state.patterns[0].tracks[0].steps[8].active;
  toggleStep(state, 8);
  assert.equal(state.patterns[0].tracks[0].steps[8].active, disabledStepWasActive);

  toggleStep(state, 1);
  assert.equal(state.patterns[0].tracks[0].steps[1].active, true);
});

test("loops a ten-step track consistently without alternating with six steps", () => {
  const playhead = Array.from({ length: 30 }, (_, transportTick) =>
    getTrackPlayhead(transportTick, 10)
  );

  assert.deepEqual(playhead, [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9
  ]);
});

test("queues pattern changes during playback and commits at the cycle boundary", () => {
  const state = createInitialState();

  selectPattern(state, 2, true);
  assert.equal(state.selectedPattern, 0);
  assert.equal(state.queuedPattern, 2);

  commitQueuedPattern(state);
  assert.equal(state.selectedPattern, 2);
  assert.equal(state.queuedPattern, null);
});

test("keeps sample start and end in a valid order", () => {
  const state = createInitialState();

  setParameter(state, "start", 100);
  assert.equal(state.patterns[0].tracks[0].parameters.start, 99);

  setParameter(state, "end", 0);
  assert.equal(state.patterns[0].tracks[0].parameters.end, 100);
});

test("restores safe values from persisted state", () => {
  const raw = createInitialState();
  raw.tempo = 999;
  raw.swing = -12;
  raw.compressor = 130;
  raw.selectedTrack = 99;
  raw.patterns[0].tracks[0].length = 0;
  raw.trackParameters[0].volume = -50;
  raw.trackParameters[0].start = 99;
  raw.trackParameters[0].end = 1;
  raw.patterns[0].tracks[0].parameters.filterType = "not-a-filter";
  raw.patterns[0].tracks[0].parameters.fxType = "not-an-effect";

  const restored = restoreState(raw);
  assert.equal(restored.tempo, 240);
  assert.equal(restored.swing, 0);
  assert.equal(restored.compressor, 100);
  assert.equal(restored.selectedTrack, 7);
  assert.equal(restored.patterns[0].tracks[0].length, 1);
  assert.equal(restored.trackParameters[0].volume, 0);
  assert.ok(restored.trackParameters[0].start < restored.trackParameters[0].end);
  assert.equal(restored.patterns[0].tracks[0].parameters.filterType, "lowpass");
  assert.equal(restored.patterns[0].tracks[0].parameters.fxType, "delay");
});

test("restores legacy global knob positions into pattern tracks", () => {
  const raw = createInitialState();
  raw.trackParameters[2].filter = 41;
  raw.patterns.forEach((pattern) => {
    delete pattern.tracks[2].parameters;
  });

  const restored = restoreState(raw);

  assert.equal(restored.patterns[0].tracks[2].parameters.filter, 41);
  assert.equal(restored.patterns[31].tracks[2].parameters.filter, 41);
});

test("defaults the global sidechain compressor amount to zero", () => {
  const state = createInitialState();
  const legacyState = { ...state };
  delete legacyState.compressor;

  assert.equal(state.compressor, 0);
  assert.equal(restoreState(legacyState).compressor, 0);
});
