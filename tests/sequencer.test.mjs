import test from "node:test";
import assert from "node:assert/strict";
import {
  getPlaybackRate,
  getStepDurationSeconds,
  getStepEvents,
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
  assert.throws(
    () => validatePackManifest({ ...pack, tracks: pack.tracks.slice(0, 7) }),
    /exactly eight/
  );
  assert.throws(
    () => validatePackManifest({ ...pack, schemaVersion: 2 }),
    /unsupported schema/
  );
});
