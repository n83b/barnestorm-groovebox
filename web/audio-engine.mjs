import {
  STEPS_PER_PATTERN,
  getPlaybackRate,
  getStepDurationSeconds,
  getStepEvents,
  validatePackManifest
} from "./sequencer.mjs?v=dev";
import { FILTER_TYPES, FX_TYPES } from "./state.mjs?v=dev";

const SCHEDULE_INTERVAL_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.1;
const START_LEAD_SECONDS = 0.04;
const MASTER_GAIN = 0.58;
const PARAMETER_TRANSITION_SECONDS = 0.012;
const FILTER_MIN_HZ = 45;
const FILTER_MAX_HZ = 18_000;
const FILTER_MAX_Q = 12;
const DELAY_MIN_SECONDS = 0.06;
const DELAY_MAX_SECONDS = 0.48;
const DELAY_MAX_FEEDBACK = 0.52;
const DELAY_WET_GAIN = 0.62;
const REVERB_MAX_WET_GAIN = 0.72;
const CHORUS_WET_GAIN = 0.68;
const DISTORTION_WET_GAIN = 0.56;
const SIDECHAIN_ATTACK_SECONDS = 0.008;

const DEFAULT_TRACK_PARAMETERS = {
  volume: 78,
  pan: 0,
  pitch: 0,
  start: 0,
  end: 100,
  filter: 86,
  resonance: 18,
  fx: 35,
  fxDepth: 24,
  filterType: "lowpass",
  fxType: "delay"
};

export function createDistortionCurve(amount, sampleCount = 1024) {
  const drive = 1 + clampNumber(amount, 0, 100, 35) * 0.45;
  const curve = new Float32Array(sampleCount);

  for (let index = 0; index < sampleCount; index += 1) {
    const input = (index * 2) / (sampleCount - 1) - 1;
    curve[index] = Math.tanh(input * drive) / Math.tanh(drive);
  }
  return curve;
}

export function getSampleWindow(buffer, startPercent, endPercent) {
  const bufferDuration = Math.max(0, Number(buffer?.duration) || 0);
  const start = clampNumber(startPercent, 0, 99, 0);
  const end = Math.max(start + 0.01, clampNumber(endPercent, 1, 100, 100));

  return {
    offset: bufferDuration * (start / 100),
    duration: Math.max(0.001, bufferDuration * ((end - start) / 100))
  };
}

export function getFilterFrequency(percent, sampleRate = 48_000) {
  const maximum = Math.min(FILTER_MAX_HZ, Math.max(FILTER_MIN_HZ, sampleRate * 0.45));
  const normalized = clampNumber(percent, 0, 100, 100) / 100;
  return FILTER_MIN_HZ * ((maximum / FILTER_MIN_HZ) ** normalized);
}

export function createWaveformPeaks(buffer, segmentCount = 48) {
  const length = Math.max(0, Number(buffer?.length) || 0);
  const channelCount = Math.max(0, Number(buffer?.numberOfChannels) || 0);
  const segments = Math.max(1, Math.min(256, Math.round(Number(segmentCount) || 48)));
  if (!length || !channelCount || typeof buffer?.getChannelData !== "function") return [];

  const channels = Array.from(
    { length: channelCount },
    (_, channelIndex) => buffer.getChannelData(channelIndex)
  );
  const peaks = Array.from({ length: segments }, (_, segmentIndex) => {
    const start = Math.floor((segmentIndex / segments) * length);
    const end = Math.max(start + 1, Math.floor(((segmentIndex + 1) / segments) * length));
    let minimum = 1;
    let maximum = -1;

    for (const channel of channels) {
      for (let sampleIndex = start; sampleIndex < end && sampleIndex < channel.length; sampleIndex += 1) {
        const sample = Number(channel[sampleIndex]) || 0;
        minimum = Math.min(minimum, sample);
        maximum = Math.max(maximum, sample);
      }
    }

    return [minimum, maximum];
  });
  const absolutePeak = peaks.reduce(
    (largest, [minimum, maximum]) => Math.max(largest, Math.abs(minimum), Math.abs(maximum)),
    0
  );
  if (absolutePeak === 0) return peaks.map(() => [0, 0]);
  return peaks.map(([minimum, maximum]) => [minimum / absolutePeak, maximum / absolutePeak]);
}

function clampNumber(value, minimum, maximum, fallback = minimum) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(maximum, Math.max(minimum, number))
    : fallback;
}

export class AudioEngine {
  constructor({
    AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext,
    fetchImpl = globalThis.fetch?.bind(globalThis),
    setIntervalImpl = globalThis.setInterval?.bind(globalThis),
    clearIntervalImpl = globalThis.clearInterval?.bind(globalThis),
    setTimeoutImpl = globalThis.setTimeout?.bind(globalThis),
    clearTimeoutImpl = globalThis.clearTimeout?.bind(globalThis),
    onStatusChange = () => {}
  } = {}) {
    this.AudioContextClass = AudioContextClass;
    this.fetchImpl = fetchImpl;
    this.setIntervalImpl = setIntervalImpl;
    this.clearIntervalImpl = clearIntervalImpl;
    this.setTimeoutImpl = setTimeoutImpl;
    this.clearTimeoutImpl = clearTimeoutImpl;
    this.onStatusChange = onStatusChange;
    this.context = null;
    this.masterGain = null;
    this.limiter = null;
    this.trackStrips = [];
    this.pack = null;
    this.buffers = [];
    this.waveformPeaks = [];
    this.loadPromise = null;
    this.status = "idle";
    this.isPlaying = false;
    this.transport = null;
    this.transportTick = 0;
    this.scheduledPatternIndex = 0;
    this.nextStepTime = 0;
    this.schedulerTimer = null;
    this.uiTimers = new Set();
    this.voices = new Set();
    this.previewVoice = null;
    this.reverbImpulse = null;
    this.compressor = 0;
    this.muted = Array.from({ length: 8 }, () => false);
    this.trackParameters = Array.from(
      { length: 8 },
      () => ({ ...DEFAULT_TRACK_PARAMETERS })
    );
  }

  loadPack(pack) {
    this.loadPromise = this.#loadPack(pack);
    return this.loadPromise;
  }

  getWaveformPeaks(trackIndex) {
    return this.waveformPeaks[trackIndex] ?? [];
  }

  async start(transportState) {
    if (this.isPlaying) return;

    await this.resume();
    if (this.loadPromise) await this.loadPromise;
    if (!this.pack || this.buffers.length !== 8) {
      throw new Error("The weekly sample pack is not ready.");
    }
    if (typeof transportState?.getState !== "function") {
      throw new TypeError("Audio transport requires a getState callback.");
    }

    this.stop();
    this.transport = transportState;
    const snapshot = transportState.getState();
    this.isPlaying = true;
    this.transportTick = 0;
    this.scheduledPatternIndex = snapshot.selectedPattern;
    this.nextStepTime = this.context.currentTime + START_LEAD_SECONDS;
    this.#schedule();
    this.schedulerTimer = this.setIntervalImpl(
      () => this.#schedule(),
      SCHEDULE_INTERVAL_MS
    );
  }

  stop() {
    this.isPlaying = false;
    this.transport = null;
    this.transportTick = 0;
    if (this.schedulerTimer != null) {
      this.clearIntervalImpl(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    for (const timer of this.uiTimers) {
      this.clearTimeoutImpl(timer);
    }
    this.uiTimers.clear();
    for (const voice of this.voices) {
      this.#stopVoice(voice);
    }
    this.voices.clear();
    this.previewVoice = null;
  }

  async preview(trackIndex, note, velocity) {
    if (this.muted[trackIndex]) return;

    await this.resume();
    if (this.loadPromise) await this.loadPromise;
    if (!this.buffers[trackIndex]) return;

    if (this.previewVoice) {
      this.#stopVoice(this.previewVoice);
      this.previewVoice = null;
    }

    this.previewVoice = this.#playSample({
      trackIndex,
      note,
      velocity,
      when: this.context.currentTime
    });
  }

  setTrackParameters(trackIndex, parameters) {
    if (trackIndex < 0 || trackIndex >= this.trackParameters.length) return;
    const previousPitch = this.trackParameters[trackIndex].pitch;
    this.trackParameters[trackIndex] = {
      ...this.trackParameters[trackIndex],
      ...parameters
    };
    this.#applyTrackParameters(
      trackIndex,
      false,
      null,
      null,
      this.context?.currentTime ?? 0,
      this.isPlaying
    );
    if (this.trackParameters[trackIndex].pitch !== previousPitch) {
      this.#applyActiveVoicePitch(
        trackIndex,
        this.trackParameters[trackIndex],
        this.context?.currentTime ?? 0,
        this.isPlaying
      );
    }
  }

  setMuted(trackIndex, muted) {
    if (trackIndex < 0 || trackIndex >= this.muted.length) return;
    this.muted[trackIndex] = Boolean(muted);
    const muteGain = this.trackStrips[trackIndex]?.muteGain?.gain;
    if (muteGain) {
      this.#setAudioParam(muteGain, this.muted[trackIndex] ? 0 : 1);
    }
  }

  setCompressor(amount) {
    this.compressor = clampNumber(amount, 0, 100, 0);
  }

  async resume() {
    const context = this.#getContext();
    if (context.state !== "running" && typeof context.resume === "function") {
      await context.resume();
    }

    if (this.isPlaying && this.nextStepTime < context.currentTime) {
      this.nextStepTime = context.currentTime + START_LEAD_SECONDS;
    }
  }

  #getContext() {
    if (this.context) return this.context;
    if (!this.AudioContextClass) {
      throw new Error("Web Audio is not supported by this browser.");
    }

    this.context = new this.AudioContextClass({ latencyHint: "interactive" });
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = MASTER_GAIN;
    this.limiter = this.context.createDynamicsCompressor?.() ?? this.context.createGain();
    this.#configureLimiter(this.limiter);
    this.masterGain.connect(this.limiter);
    this.limiter.connect(this.context.destination);
    this.trackStrips = Array.from(
      { length: this.trackParameters.length },
      (_, trackIndex) => this.#createTrackStrip(trackIndex)
    );
    this.context.addEventListener?.("statechange", () => {
      if (
        this.isPlaying
        && this.context.state === "running"
        && this.nextStepTime < this.context.currentTime
      ) {
        this.nextStepTime = this.context.currentTime + START_LEAD_SECONDS;
        this.#schedule();
      }
    });
    return this.context;
  }

  async #loadPack(packSource) {
    this.#setStatus("loading");

    try {
      let manifest;
      let deliveredSamples = null;
      let baseUrl = globalThis.location?.href ?? "http://localhost/";

      if (packSource?.manifest && Array.isArray(packSource.samples)) {
        manifest = packSource.manifest;
        deliveredSamples = new Map(
          packSource.samples.map((sample) => [sample.trackId, sample.data])
        );
      } else if (typeof packSource === "string" || packSource instanceof URL) {
        if (!this.fetchImpl) throw new Error("Fetch is unavailable.");
        const manifestUrl = new URL(String(packSource), baseUrl);
        const response = await this.fetchImpl(manifestUrl.href);
        if (!response.ok) {
          throw new Error(`Could not load pack manifest (${response.status}).`);
        }
        manifest = await response.json();
        baseUrl = manifestUrl.href;
      } else {
        manifest = packSource;
      }

      const pack = validatePackManifest(manifest);
      const context = this.#getContext();
      const buffers = await Promise.all(pack.tracks.map(async (track) => {
        if (deliveredSamples) {
          const data = deliveredSamples.get(track.id);
          if (!(data instanceof ArrayBuffer)) {
            throw new Error(`The delivered pack is missing ${track.name ?? track.id}.`);
          }
          return context.decodeAudioData(data.slice(0));
        }
        const response = await this.fetchImpl(new URL(track.file, baseUrl).href);
        if (!response.ok) {
          throw new Error(`Could not load ${track.name ?? track.id} (${response.status}).`);
        }
        return context.decodeAudioData(await response.arrayBuffer());
      }));

      this.pack = pack;
      this.buffers = buffers;
      this.waveformPeaks = buffers.map((buffer) => createWaveformPeaks(buffer));
      this.#setStatus("ready", pack);
      return pack;
    } catch (error) {
      this.#setStatus("error", error);
      throw error;
    }
  }

  #schedule() {
    if (!this.isPlaying || !this.transport) return;

    const scheduleUntil = this.context.currentTime + SCHEDULE_AHEAD_SECONDS;
    while (this.nextStepTime < scheduleUntil) {
      const snapshot = this.transport.getState();

      if (
        this.transportTick > 0
        && this.transportTick % STEPS_PER_PATTERN === 0
        && snapshot.queuedPattern != null
      ) {
        this.scheduledPatternIndex = snapshot.queuedPattern;
      }

      const pattern = snapshot.patterns[this.scheduledPatternIndex];
      const scheduledParameters = pattern.tracks.map((patternTrack, trackIndex) => {
        const length = Math.max(
          1,
          Math.min(STEPS_PER_PATTERN, Math.round(Number(patternTrack.length) || STEPS_PER_PATTERN))
        );
        const stepIndex = this.transportTick % length;
        return {
          ...(patternTrack.parameters
            ?? snapshot.trackParameters?.[trackIndex]
            ?? this.trackParameters[trackIndex]),
          ...(patternTrack.steps?.[stepIndex]?.automation ?? {})
        };
      });
      scheduledParameters.forEach((parameters, trackIndex) => {
        this.#applyTrackParameters(
          trackIndex,
          false,
          null,
          parameters,
          this.nextStepTime
        );
        this.#applyActiveVoicePitch(trackIndex, parameters, this.nextStepTime);
      });

      const events = getStepEvents(pattern, this.transportTick, this.muted);
      for (const event of events) {
        this.#playSample({
          ...event,
          when: this.nextStepTime,
          parameters: scheduledParameters[event.trackIndex]
        });
      }
      if (events.some((event) => event.trackIndex === 0)) {
        this.#scheduleSidechain(this.nextStepTime);
      }

      this.#scheduleUiTick({
        tick: this.transportTick,
        time: this.nextStepTime,
        patternIndex: this.scheduledPatternIndex
      });

      this.nextStepTime += getStepDurationSeconds(
        snapshot.tempo,
        snapshot.swing,
        this.transportTick
      );
      this.transportTick += 1;
    }
  }

  #scheduleUiTick(tickState) {
    const delay = Math.max(0, (tickState.time - this.context.currentTime) * 1000);
    const timer = this.setTimeoutImpl(() => {
      this.uiTimers.delete(timer);
      if (this.isPlaying) this.transport?.onTick?.(tickState);
    }, delay);
    this.uiTimers.add(timer);
  }

  #playSample({
    trackIndex,
    note,
    velocity,
    when,
    parameters = this.trackParameters[trackIndex]
  }) {
    const buffer = this.buffers[trackIndex];
    const track = this.pack?.tracks?.[trackIndex];
    if (!buffer || !track) return null;

    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const playbackRate = getPlaybackRate({
      kind: track.kind,
      note,
      rootNote: track.rootNote,
      transpose: parameters.pitch
    });
    const velocityGain = Math.max(1, Math.min(127, Number(velocity) || 1)) / 127;
    const sampleWindow = getSampleWindow(buffer, parameters.start, parameters.end);
    const audibleDuration = sampleWindow.duration / playbackRate;
    const voice = { source, gain, trackIndex, note };

    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    gain.gain.value = velocityGain;
    this.#scheduleVoiceEnvelope(gain.gain, velocityGain, when, audibleDuration);
    source.connect(gain);
    gain.connect(this.trackStrips[trackIndex].input);
    source.addEventListener?.("ended", () => {
      this.voices.delete(voice);
      if (this.previewVoice === voice) this.previewVoice = null;
      source.disconnect();
      gain.disconnect();
    }, { once: true });
    this.voices.add(voice);
    source.start(when, sampleWindow.offset, sampleWindow.duration);
    return voice;
  }

  #createTrackStrip(trackIndex) {
    const input = this.context.createGain();
    const filter = this.context.createBiquadFilter?.() ?? this.context.createGain();
    const panner = this.context.createStereoPanner?.() ?? this.context.createGain();
    const volume = this.context.createGain();
    const muteGain = this.context.createGain();
    const duckGain = this.context.createGain();
    const delaySend = this.context.createGain();
    const delay = this.context.createDelay?.(DELAY_MAX_SECONDS + 0.1) ?? this.context.createGain();
    const delayFeedback = this.context.createGain();
    const delayWet = this.context.createGain();
    const reverbSend = this.context.createGain();
    const reverb = this.context.createConvolver?.() ?? this.context.createGain();
    const reverbWet = this.context.createGain();
    const chorusSend = this.context.createGain();
    const chorusDelay = this.context.createDelay?.(0.05) ?? this.context.createGain();
    const chorusWet = this.context.createGain();
    const chorusLfo = this.context.createOscillator?.() ?? null;
    const chorusLfoDepth = this.context.createGain();
    const distortionSend = this.context.createGain();
    const distortion = this.context.createWaveShaper?.() ?? this.context.createGain();
    const distortionWet = this.context.createGain();

    if ("type" in filter) filter.type = "lowpass";
    if ("buffer" in reverb) reverb.buffer = this.#createReverbImpulse();
    if ("oversample" in distortion) distortion.oversample = "2x";
    input.connect(filter);
    filter.connect(panner);
    panner.connect(volume);
    volume.connect(muteGain);
    volume.connect(delaySend);
    delaySend.connect(delay);
    delay.connect(delayWet);
    delayWet.connect(muteGain);
    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
    volume.connect(reverbSend);
    reverbSend.connect(reverb);
    reverb.connect(reverbWet);
    reverbWet.connect(muteGain);
    volume.connect(chorusSend);
    chorusSend.connect(chorusDelay);
    chorusDelay.connect(chorusWet);
    chorusWet.connect(muteGain);
    if (chorusLfo && chorusDelay.delayTime) {
      chorusLfo.connect(chorusLfoDepth);
      chorusLfoDepth.connect(chorusDelay.delayTime);
      chorusLfo.start();
    }
    volume.connect(distortionSend);
    distortionSend.connect(distortion);
    distortion.connect(distortionWet);
    distortionWet.connect(muteGain);
    muteGain.connect(duckGain);
    duckGain.connect(this.masterGain);

    const strip = {
      input,
      filter,
      panner,
      volume,
      muteGain,
      duckGain,
      delaySend,
      delay,
      delayFeedback,
      delayWet,
      reverbSend,
      reverb,
      reverbWet,
      chorusSend,
      chorusDelay,
      chorusWet,
      chorusLfo,
      chorusLfoDepth,
      distortionSend,
      distortion,
      distortionWet
    };
    this.trackStrips[trackIndex] = strip;
    this.#applyTrackParameters(trackIndex, true, strip);
    return strip;
  }

  #applyTrackParameters(
    trackIndex,
    immediate = false,
    stripOverride = null,
    parameterOverride = null,
    when = this.context?.currentTime ?? 0,
    preserveFuture = false
  ) {
    const strip = stripOverride ?? this.trackStrips[trackIndex];
    if (!strip || !this.context) return;

    const parameters = parameterOverride ?? this.trackParameters[trackIndex];
    const volume = clampNumber(parameters.volume, 0, 100, 78) / 100;
    const pan = clampNumber(parameters.pan, -100, 100, 0) / 100;
    const filterFrequency = getFilterFrequency(parameters.filter, this.context.sampleRate);
    const resonance = (clampNumber(parameters.resonance, 0, 100, 18) / 100) * FILTER_MAX_Q;
    const filterType = FILTER_TYPES.some((option) => option.value === parameters.filterType)
      ? parameters.filterType
      : "lowpass";
    const fxType = FX_TYPES.some((option) => option.value === parameters.fxType)
      ? parameters.fxType
      : "delay";
    const effectCharacter = clampNumber(parameters.fx, 0, 100, 35) / 100;
    const effectDepth = clampNumber(parameters.fxDepth, 0, 100, 24) / 100;
    const delayTime = DELAY_MIN_SECONDS
      + effectCharacter * (DELAY_MAX_SECONDS - DELAY_MIN_SECONDS);
    const delayFeedback = 0.08 + effectCharacter * (DELAY_MAX_FEEDBACK - 0.08);

    this.#setAudioParam(strip.volume.gain, volume, immediate, when, preserveFuture);
    if (strip.panner.pan) {
      this.#setAudioParam(strip.panner.pan, pan, immediate, when, preserveFuture);
    }
    if (strip.filter.frequency) {
      if ("type" in strip.filter) strip.filter.type = filterType;
      this.#setAudioParam(
        strip.filter.frequency,
        filterFrequency,
        immediate,
        when,
        preserveFuture
      );
    }
    if (strip.filter.Q) {
      this.#setAudioParam(strip.filter.Q, resonance, immediate, when, preserveFuture);
    }
    if (strip.delay.delayTime) {
      this.#setAudioParam(
        strip.delay.delayTime,
        delayTime,
        immediate,
        when,
        preserveFuture
      );
    }
    this.#setAudioParam(
      strip.delayFeedback.gain,
      delayFeedback,
      immediate,
      when,
      preserveFuture
    );
    this.#setAudioParam(
      strip.delaySend.gain,
      fxType === "delay" ? effectDepth : 0,
      immediate,
      when,
      preserveFuture
    );
    this.#setAudioParam(
      strip.reverbSend.gain,
      fxType === "reverb" ? effectDepth : 0,
      immediate,
      when,
      preserveFuture
    );
    this.#setAudioParam(
      strip.reverbWet.gain,
      0.28 + effectCharacter * (REVERB_MAX_WET_GAIN - 0.28),
      immediate,
      when,
      preserveFuture
    );
    if (strip.chorusDelay.delayTime) {
      this.#setAudioParam(
        strip.chorusDelay.delayTime,
        0.008 + effectCharacter * 0.014,
        immediate,
        when,
        preserveFuture
      );
    }
    if (strip.chorusLfo?.frequency) {
      this.#setAudioParam(
        strip.chorusLfo.frequency,
        0.18 + effectCharacter * 1.65,
        immediate,
        when,
        preserveFuture
      );
    }
    this.#setAudioParam(
      strip.chorusLfoDepth.gain,
      0.0015 + effectCharacter * 0.0035,
      immediate,
      when,
      preserveFuture
    );
    this.#setAudioParam(
      strip.chorusSend.gain,
      fxType === "chorus" ? effectDepth : 0,
      immediate,
      when,
      preserveFuture
    );
    this.#setAudioParam(
      strip.chorusWet.gain,
      CHORUS_WET_GAIN,
      immediate,
      when,
      preserveFuture
    );
    if ("curve" in strip.distortion) {
      strip.distortion.curve = createDistortionCurve(effectCharacter * 100);
    }
    this.#setAudioParam(
      strip.distortionSend.gain,
      fxType === "distortion" ? effectDepth : 0,
      immediate,
      when,
      preserveFuture
    );
    this.#setAudioParam(
      strip.distortionWet.gain,
      DISTORTION_WET_GAIN,
      immediate,
      when,
      preserveFuture
    );
    this.#setAudioParam(
      strip.delayWet.gain,
      DELAY_WET_GAIN,
      immediate,
      when,
      preserveFuture
    );
    this.#setAudioParam(
      strip.muteGain.gain,
      this.muted[trackIndex] ? 0 : 1,
      immediate,
      when,
      preserveFuture
    );
    if (immediate) this.#setAudioParam(strip.duckGain.gain, 1, true, when);
  }

  #applyActiveVoicePitch(
    trackIndex,
    parameters = this.trackParameters[trackIndex],
    when = this.context?.currentTime ?? 0,
    preserveFuture = false
  ) {
    const track = this.pack?.tracks?.[trackIndex];
    if (!track) return;

    for (const voice of this.voices) {
      if (voice.trackIndex !== trackIndex) continue;
      const playbackRate = getPlaybackRate({
        kind: track.kind,
        note: voice.note,
        rootNote: track.rootNote,
        transpose: parameters.pitch
      });
      this.#setAudioParam(
        voice.source.playbackRate,
        playbackRate,
        false,
        when,
        preserveFuture
      );
    }
  }

  #setAudioParam(
    parameter,
    value,
    immediate = false,
    when = this.context?.currentTime ?? 0,
    preserveFuture = false
  ) {
    if (!parameter) return;

    if (immediate || typeof parameter.setTargetAtTime !== "function") {
      parameter.cancelScheduledValues?.(when);
      if (typeof parameter.setValueAtTime === "function") {
        parameter.setValueAtTime(value, when);
      } else {
        parameter.value = value;
      }
      return;
    }

    if (preserveFuture) {
      parameter.setTargetAtTime(value, when, PARAMETER_TRANSITION_SECONDS);
      return;
    }

    if (typeof parameter.cancelAndHoldAtTime === "function") {
      parameter.cancelAndHoldAtTime(when);
    } else {
      parameter.cancelScheduledValues?.(when);
      parameter.setValueAtTime?.(parameter.value, when);
    }
    parameter.setTargetAtTime(value, when, PARAMETER_TRANSITION_SECONDS);
  }

  #scheduleVoiceEnvelope(parameter, peak, when, audibleDuration) {
    const fadeSeconds = Math.min(0.006, audibleDuration / 2);
    parameter.setValueAtTime?.(peak, when);
    if (fadeSeconds <= 0 || typeof parameter.linearRampToValueAtTime !== "function") return;
    parameter.setValueAtTime(peak, Math.max(when, when + audibleDuration - fadeSeconds));
    parameter.linearRampToValueAtTime(0, when + audibleDuration);
  }

  #scheduleSidechain(when) {
    const amount = this.compressor / 100;
    if (amount <= 0) return;

    const floor = Math.max(0.18, 1 - amount * 0.82);
    const recovery = 0.045 + amount * 0.11;
    for (let trackIndex = 1; trackIndex < this.trackStrips.length; trackIndex += 1) {
      const parameter = this.trackStrips[trackIndex].duckGain.gain;
      if (typeof parameter.cancelAndHoldAtTime === "function") {
        parameter.cancelAndHoldAtTime(when);
      } else {
        parameter.cancelScheduledValues?.(when);
        parameter.setValueAtTime?.(parameter.value, when);
      }
      if (typeof parameter.linearRampToValueAtTime === "function") {
        parameter.linearRampToValueAtTime(floor, when + SIDECHAIN_ATTACK_SECONDS);
        parameter.setTargetAtTime?.(1, when + SIDECHAIN_ATTACK_SECONDS, recovery);
      } else {
        parameter.value = floor;
      }
    }
  }

  #createReverbImpulse() {
    if (typeof this.context.createBuffer !== "function") return null;
    if (this.reverbImpulse) return this.reverbImpulse;

    const duration = 1.65;
    const length = Math.round(this.context.sampleRate * duration);
    const impulse = this.context.createBuffer(2, length, this.context.sampleRate);
    for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
      const data = impulse.getChannelData(channel);
      for (let index = 0; index < length; index += 1) {
        const decay = (1 - index / length) ** 2.4;
        data[index] = (Math.random() * 2 - 1) * decay;
      }
    }
    this.reverbImpulse = impulse;
    return this.reverbImpulse;
  }

  #configureLimiter(limiter) {
    if (!limiter) return;
    if (limiter.threshold) limiter.threshold.value = -5;
    if (limiter.knee) limiter.knee.value = 0;
    if (limiter.ratio) limiter.ratio.value = 20;
    if (limiter.attack) limiter.attack.value = 0.003;
    if (limiter.release) limiter.release.value = 0.12;
  }

  #stopVoice(voice) {
    try {
      voice.source.stop();
    } catch {
      // A source may already have ended between scheduling and cleanup.
    }
    voice.source.disconnect();
    voice.gain.disconnect();
    this.voices.delete(voice);
  }

  #setStatus(status, detail) {
    this.status = status;
    this.onStatusChange(status, detail);
  }
}
