import test from "node:test";
import assert from "node:assert/strict";
import {
  AudioEngine,
  getFilterFrequency,
  getSampleWindow
} from "../web/audio-engine.mjs";
import { createInitialState } from "../web/state.mjs";

class FakeAudioParam {
  constructor(value = 0) {
    this.value = value;
    this.events = [];
  }

  cancelScheduledValues(when) {
    this.events.push({ type: "cancel", when });
  }

  cancelAndHoldAtTime(when) {
    this.events.push({ type: "hold", when });
  }

  setValueAtTime(value, when) {
    this.value = value;
    this.events.push({ type: "set", value, when });
  }

  setTargetAtTime(value, when, timeConstant) {
    this.events.push({ type: "target", value, when, timeConstant });
  }

  linearRampToValueAtTime(value, when) {
    this.events.push({ type: "linear", value, when });
  }
}

class FakeNode {
  constructor() {
    this.connections = [];
  }

  connect(node) {
    this.connections.push(node);
    return node;
  }

  disconnect() {
    this.connections = [];
  }
}

class FakeGain extends FakeNode {
  constructor() {
    super();
    this.gain = new FakeAudioParam(1);
  }
}

class FakeFilter extends FakeNode {
  constructor() {
    super();
    this.type = "";
    this.frequency = new FakeAudioParam(350);
    this.Q = new FakeAudioParam(1);
  }
}

class FakePanner extends FakeNode {
  constructor() {
    super();
    this.pan = new FakeAudioParam(0);
  }
}

class FakeDelay extends FakeNode {
  constructor() {
    super();
    this.delayTime = new FakeAudioParam(0);
  }
}

class FakeCompressor extends FakeNode {
  constructor() {
    super();
    this.threshold = new FakeAudioParam(-24);
    this.knee = new FakeAudioParam(30);
    this.ratio = new FakeAudioParam(12);
    this.attack = new FakeAudioParam(0.003);
    this.release = new FakeAudioParam(0.25);
  }
}

class FakeSource extends FakeNode {
  constructor(context) {
    super();
    this.context = context;
    this.buffer = null;
    this.playbackRate = new FakeAudioParam(1);
    this.stopped = false;
  }

  addEventListener() {}

  start(when, offset, duration) {
    this.context.starts.push({
      buffer: this.buffer,
      gain: this.connections[0].gain.value,
      playbackRate: this.playbackRate.value,
      when,
      offset,
      duration
    });
  }

  stop() {
    this.stopped = true;
  }
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 10;
    this.sampleRate = 48_000;
    this.state = "suspended";
    this.destination = new FakeNode();
    this.starts = [];
    this.sources = [];
    this.decodedBuffers = 0;
    FakeAudioContext.instance = this;
  }

  createGain() {
    return new FakeGain();
  }

  createBufferSource() {
    const source = new FakeSource(this);
    this.sources.push(source);
    return source;
  }

  createBiquadFilter() {
    return new FakeFilter();
  }

  createStereoPanner() {
    return new FakePanner();
  }

  createDelay() {
    return new FakeDelay();
  }

  createDynamicsCompressor() {
    return new FakeCompressor();
  }

  async decodeAudioData() {
    const buffer = { id: this.decodedBuffers, duration: 2 };
    this.decodedBuffers += 1;
    return buffer;
  }

  async resume() {
    this.state = "running";
  }

  addEventListener() {}
}

const pack = {
  id: "test-pack",
  week: 31,
  name: "Test Pack",
  tracks: Array.from({ length: 8 }, (_, index) => ({
    id: `track-${index}`,
    name: `Track ${index}`,
    kind: index < 4 ? "drum" : "chromatic",
    rootNote: 48,
    file: `./track-${index}.wav`
  }))
};

function createFetch() {
  return async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8)
  });
}

test("decodes delivered sample buffers without fetching them again", async () => {
  const engine = new AudioEngine({
    AudioContextClass: FakeAudioContext,
    fetchImpl: async () => { throw new Error("unexpected fetch"); }
  });

  await engine.loadPack({
    manifest: pack,
    samples: pack.tracks.map((track) => ({
      trackId: track.id,
      data: new ArrayBuffer(8)
    }))
  });

  assert.equal(FakeAudioContext.instance.decodedBuffers, 8);
  assert.equal(engine.pack.id, pack.id);
});

test("maps sample windows and filter cutoff across safe musical ranges", () => {
  assert.deepEqual(
    getSampleWindow({ duration: 4 }, 25, 75),
    { offset: 1, duration: 2 }
  );
  assert.equal(getFilterFrequency(0), 45);
  assert.ok(getFilterFrequency(50) > 45);
  assert.ok(getFilterFrequency(100) <= 18_000);
});

test("loads eight buffers and schedules the complete per-track signal path", async () => {
  const pendingUiTicks = [];
  const state = createInitialState();
  const engine = new AudioEngine({
    AudioContextClass: FakeAudioContext,
    fetchImpl: createFetch(),
    setIntervalImpl: () => 1,
    clearIntervalImpl: () => {},
    setTimeoutImpl: (callback) => {
      pendingUiTicks.push(callback);
      return pendingUiTicks.length;
    },
    clearTimeoutImpl: () => {}
  });

  engine.setMuted(0, true);
  Object.assign(state.trackParameters[4], {
    volume: 50,
    pan: 60,
    pitch: 12,
    start: 25,
    end: 75,
    filter: 50,
    resonance: 25,
    fx: 50,
    fxDepth: 40
  });
  Object.assign(state.patterns[0].tracks[4].parameters, state.trackParameters[4]);
  engine.setTrackParameters(4, state.trackParameters[4]);
  await engine.loadPack(pack);
  await engine.start({ getState: () => state });

  const context = FakeAudioContext.instance;
  assert.equal(context.decodedBuffers, 8);
  assert.equal(context.state, "running");
  assert.equal(context.starts.some((start) => start.buffer.id === 0), false);

  const bass = context.starts.find((start) => start.buffer.id === 4);
  assert.ok(bass);
  assert.ok(Math.abs(bass.playbackRate - 2 ** (12 / 12)) < 1e-12);
  assert.ok(Math.abs(bass.gain - (112 / 127)) < 1e-12);
  assert.equal(bass.offset, 0.5);
  assert.equal(bass.duration, 1);

  const bassStrip = engine.trackStrips[4];
  assert.equal(bassStrip.volume.gain.value, 0.5);
  assert.equal(bassStrip.panner.pan.value, 0.6);
  assert.equal(bassStrip.filter.type, "lowpass");
  assert.equal(bassStrip.filter.frequency.value, getFilterFrequency(50));
  assert.equal(bassStrip.filter.Q.value, 3);
  assert.equal(bassStrip.delaySend.gain.value, 0.4);
  assert.equal(engine.limiter.threshold.value, -5);
  assert.equal(engine.limiter.ratio.value, 20);

  engine.stop();
});

test("schedules per-step automation over pattern knob positions", async () => {
  const state = createInitialState();
  Object.assign(state.patterns[0].tracks[4].parameters, {
    volume: 55,
    pan: 25,
    resonance: 30
  });
  state.patterns[0].tracks[4].steps[0].automation = {
    volume: 33,
    pan: -50,
    pitch: 12,
    start: 25,
    end: 75,
    filter: 20,
    fx: 60,
    fxDepth: 70
  };
  const engine = new AudioEngine({
    AudioContextClass: FakeAudioContext,
    fetchImpl: createFetch(),
    setIntervalImpl: () => 1,
    clearIntervalImpl: () => {},
    setTimeoutImpl: () => 1,
    clearTimeoutImpl: () => {}
  });

  await engine.loadPack(pack);
  await engine.start({ getState: () => state });

  const bass = FakeAudioContext.instance.starts.find((start) => start.buffer.id === 4);
  assert.ok(Math.abs(bass.playbackRate - 2 ** (12 / 12)) < 1e-12);
  assert.equal(bass.offset, 0.5);
  assert.equal(bass.duration, 1);

  const bassStrip = engine.trackStrips[4];
  assert.ok(
    bassStrip.volume.gain.events.some((event) =>
      event.type === "target"
      && event.value === 0.33
      && event.when === 10.04
    )
  );
  assert.ok(
    bassStrip.panner.pan.events.some((event) =>
      event.type === "target"
      && event.value === -0.5
      && event.when === 10.04
    )
  );
  assert.ok(
    bassStrip.delaySend.gain.events.some((event) =>
      event.type === "target"
      && event.value === 0.7
      && event.when === 10.04
    )
  );
  assert.ok(
    bassStrip.filter.Q.events.some((event) =>
      event.type === "target"
      && Math.abs(event.value - 3.6) < 1e-12
      && event.when === 10.04
    )
  );
});

test("smooths live track changes through persistent audio nodes", async () => {
  const engine = new AudioEngine({
    AudioContextClass: FakeAudioContext,
    fetchImpl: createFetch(),
    setIntervalImpl: () => 1,
    clearIntervalImpl: () => {},
    setTimeoutImpl: () => 1,
    clearTimeoutImpl: () => {}
  });

  await engine.loadPack(pack);
  await engine.preview(2, 48, 127);
  const strip = engine.trackStrips[2];
  const livePlaybackRate = FakeAudioContext.instance.sources.at(-1).playbackRate;
  strip.volume.gain.events.length = 0;
  strip.panner.pan.events.length = 0;
  strip.filter.frequency.events.length = 0;
  livePlaybackRate.events.length = 0;

  engine.setTrackParameters(2, { volume: 42, pan: -35, pitch: 12, filter: 20 });

  assert.equal(strip.volume.gain.events.at(-1).type, "target");
  assert.equal(strip.volume.gain.events.at(-1).value, 0.42);
  assert.equal(strip.panner.pan.events.at(-1).value, -0.35);
  assert.equal(strip.filter.frequency.events.at(-1).value, getFilterFrequency(20));
  assert.equal(livePlaybackRate.events.at(-1).value, 2);
});

test("ducks the other seven tracks from kick hits at the global comp amount", async () => {
  const state = createInitialState();
  const engine = new AudioEngine({
    AudioContextClass: FakeAudioContext,
    fetchImpl: createFetch(),
    setIntervalImpl: () => 1,
    clearIntervalImpl: () => {},
    setTimeoutImpl: () => 1,
    clearTimeoutImpl: () => {}
  });

  engine.setCompressor(100);
  await engine.loadPack(pack);
  await engine.start({ getState: () => state });

  assert.equal(
    engine.trackStrips[0].duckGain.gain.events.some((event) => event.type === "linear"),
    false
  );
  for (const strip of engine.trackStrips.slice(1)) {
    const duck = strip.duckGain.gain.events.find((event) => event.type === "linear");
    const recovery = strip.duckGain.gain.events.find((event) => event.type === "target");
    assert.ok(Math.abs(duck.value - 0.18) < 1e-12);
    assert.equal(recovery.value, 1);
  }
});

test("preview keeps only one live preview voice", async () => {
  const engine = new AudioEngine({
    AudioContextClass: FakeAudioContext,
    fetchImpl: createFetch(),
    setIntervalImpl: () => 1,
    clearIntervalImpl: () => {},
    setTimeoutImpl: () => 1,
    clearTimeoutImpl: () => {}
  });

  await engine.loadPack(pack);
  engine.setTrackParameters(4, { volume: 100, pitch: 0 });
  await engine.preview(4, 48, 127);
  const firstVoice = FakeAudioContext.instance.sources.at(-1);
  const firstSource = FakeAudioContext.instance.starts.at(-1);

  await engine.preview(4, 60, 127);

  assert.equal(firstVoice.stopped, true);
  assert.equal(firstSource.playbackRate, 1);
  assert.equal(FakeAudioContext.instance.starts.at(-1).playbackRate, 2);
});
