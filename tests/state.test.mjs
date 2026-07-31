import test from "node:test";
import assert from "node:assert/strict";
import {
  BANKS,
  PARAMETER_DEFINITIONS,
  PATTERN_NAMES,
  TRACKS,
  clearTrackAutomation,
  commitQueuedPattern,
  createInitialState,
  formatNote,
  getAutomatedTrackParameters,
  getTrackPlayhead,
  hasTrackAutomation,
  restoreState,
  selectBank,
  selectPattern,
  setParameter,
  setStepAutomation,
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
  const state = createInitialState();

  assert.equal(state.patterns.length, 32);
  assert.equal(state.patterns[0].tracks.length, 8);
  assert.equal(state.patterns[0].tracks[0].steps.length, 16);
  assert.deepEqual(state.patterns[0].tracks[0].steps[0].automation, {});
  assert.notEqual(state.patterns[0].tracks[0], state.patterns[1].tracks[0]);
});

test("records independent per-step automation without changing the track base value", () => {
  const state = createInitialState();
  state.selectedTrack = 4;

  setStepAutomation(state, 3, "filter", 24);

  assert.equal(state.trackParameters[4].filter, 86);
  assert.equal(state.patterns[0].tracks[4].steps[3].automation.filter, 24);
  assert.equal(
    getAutomatedTrackParameters(state, 0, 4, 3).filter,
    24
  );
  assert.deepEqual(state.patterns[1].tracks[4].steps[3].automation, {});
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

test("creates four color-coded banks with eight numbered patterns each", () => {
  assert.deepEqual(BANKS.map((bank) => bank.color), ["#ff8a00", "#2f8cff", "#00d6d1", "#a933ff"]);
  assert.deepEqual(PATTERN_NAMES.slice(0, 8), ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"]);
  assert.deepEqual(PATTERN_NAMES.slice(8, 16), ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8"]);
});

test("each bank remembers its independently selected numbered slot", () => {
  const state = createInitialState();
  selectPattern(state, 5, false);
  selectBank(state, 1, false);
  assert.equal(state.selectedPattern, 8);

  selectPattern(state, 10, false);
  selectBank(state, 0, false);
  assert.equal(state.selectedPattern, 5);

  selectBank(state, 1, false);

  assert.equal(state.selectedBank, 1);
  assert.equal(state.selectedPattern, 10);
  assert.equal(state.patterns[state.selectedPattern].name, "B3");
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
  assert.equal(state.trackParameters[0].start, 99);

  setParameter(state, "end", 0);
  assert.equal(state.trackParameters[0].end, 100);
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

  const restored = restoreState(raw);
  assert.equal(restored.tempo, 240);
  assert.equal(restored.swing, 0);
  assert.equal(restored.compressor, 100);
  assert.equal(restored.selectedTrack, 7);
  assert.equal(restored.patterns[0].tracks[0].length, 1);
  assert.equal(restored.trackParameters[0].volume, 0);
  assert.ok(restored.trackParameters[0].start < restored.trackParameters[0].end);
});

test("defaults the global sidechain compressor amount to zero", () => {
  const state = createInitialState();
  const legacyState = { ...state };
  delete legacyState.compressor;

  assert.equal(state.compressor, 0);
  assert.equal(restoreState(legacyState).compressor, 0);
});
