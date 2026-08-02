import test from "node:test";
import assert from "node:assert/strict";
import {
  getPlaybackRate,
  getStepDurationSeconds,
  getStepEvents,
  shouldAuditionStepEdit,
  shouldRenderStepGrid,
  validatePackManifest
} from "../web/sequencer.mjs";
import { createInitialState } from "../web/state.mjs";

test("swing preserves the duration of each two-step pair", () => {
  const straightPair = getStepDurationSeconds(120, 0, 0)
    + getStepDurationSeconds(120, 0, 1);
  const swungPair = getStepDurationSeconds(120, 24, 0)
    + getStepDurationSeconds(120, 24, 1);

  assert.equal(straightPair, 0.25);
  assert.equal(swungPair, straightPair);
  assert.ok(getStepDurationSeconds(120, 24, 0) > getStepDurationSeconds(120, 24, 1));
});

test("auditions chromatic note changes but not velocity-only step edits", () => {
  assert.equal(shouldAuditionStepEdit({
    kind: "chromatic",
    previousNote: 48,
    nextNote: 48
  }), false);
  assert.equal(shouldAuditionStepEdit({
    kind: "drum",
    previousNote: 48,
    nextNote: 49
  }), false);
  assert.equal(shouldAuditionStepEdit({
    kind: "chromatic",
    previousNote: 48,
    nextNote: 49
  }), true);
});

test("pauses step-grid DOM refreshes while a native mode picker is open", () => {
  assert.equal(shouldRenderStepGrid(), true);
  assert.equal(shouldRenderStepGrid({ editingStep: true }), false);
  assert.equal(shouldRenderStepGrid({ modeSelectorOpen: true }), false);
});

test("collects active events using each track's independent last step", () => {
  const state = createInitialState();
  const pattern = state.patterns[0];
  pattern.tracks[0].length = 10;
  pattern.tracks[0].steps[1].active = true;

  const events = getStepEvents(pattern, 11, state.muted);

  assert.ok(events.some((event) => event.trackIndex === 0 && event.stepIndex === 1));
});

test("does not schedule muted tracks", () => {
  const state = createInitialState();
  state.muted[0] = true;

  const events = getStepEvents(state.patterns[0], 0, state.muted);

  assert.equal(events.some((event) => event.trackIndex === 0), false);
  assert.equal(events.some((event) => event.trackIndex === 4), true);
});

test("converts chromatic notes and track transpose to playback rates", () => {
  assert.equal(getPlaybackRate({
    kind: "chromatic",
    note: 60,
    rootNote: 48,
    transpose: 0
  }), 2);
  assert.equal(getPlaybackRate({
    kind: "drum",
    note: 72,
    rootNote: null,
    transpose: -12
  }), 0.5);
});

test("requires four drum and four chromatic samples in a weekly pack", () => {
  const pack = {
    id: "test",
    week: 31,
    name: "Test",
    tracks: Array.from({ length: 8 }, (_, index) => ({
      id: `track-${index}`,
      kind: index < 4 ? "drum" : "chromatic",
      rootNote: 48,
      file: `./track-${index}.wav`
    }))
  };

  assert.equal(validatePackManifest(pack).tracks.length, 8);
  assert.equal(validatePackManifest({ ...pack, week: 54 }).week, 54);
  assert.throws(
    () => validatePackManifest({ ...pack, tracks: pack.tracks.slice(0, 7) }),
    /exactly eight/
  );
  assert.throws(
    () => validatePackManifest({ ...pack, schemaVersion: 2 }),
    /unsupported schema/
  );
});
