import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 44_100;
const outputDirectory = fileURLToPath(
  new URL("../web/assets/packs/week-31/", import.meta.url)
);

let randomState = 0x31c0ffee;

function random() {
  randomState ^= randomState << 13;
  randomState ^= randomState >>> 17;
  randomState ^= randomState << 5;
  return ((randomState >>> 0) / 0xffffffff) * 2 - 1;
}

function render(duration, sampleAt) {
  const length = Math.ceil(duration * SAMPLE_RATE);
  const samples = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    const time = index / SAMPLE_RATE;
    samples[index] = Math.max(-1, Math.min(1, sampleAt(time, index, length)));
  }
  return samples;
}

function oscillator(phase) {
  return Math.sin(phase * Math.PI * 2);
}

function fadeOut(time, duration, curve = 1) {
  return Math.max(0, 1 - time / duration) ** curve;
}

const samples = {
  "kick.wav": render(0.48, (time) => {
    const envelope = Math.exp(-time * 10);
    const phase = 48 * time + (82 / 24) * (1 - Math.exp(-24 * time));
    const click = time < 0.012 ? random() * fadeOut(time, 0.012, 2) : 0;
    return oscillator(phase) * envelope * 0.92 + click * 0.16;
  }),
  "snare.wav": render(0.42, (time) => {
    const noise = random() * Math.exp(-time * 13);
    const body = oscillator(185 * time) * Math.exp(-time * 18);
    return noise * 0.72 + body * 0.32;
  }),
  "hi-hat.wav": (() => {
    let previousNoise = 0;
    return render(0.19, (time) => {
      const nextNoise = random();
      const highPassedNoise = nextNoise - previousNoise * 0.86;
      previousNoise = nextNoise;
      const metal = oscillator(6_731 * time) + oscillator(9_137 * time) * 0.55;
      return (highPassedNoise * 0.62 + metal * 0.19) * Math.exp(-time * 31);
    });
  })(),
  "perc.wav": render(0.36, (time) => {
    const envelope = Math.exp(-time * 15);
    const carrier = oscillator(322 * time + oscillator(91 * time) * 0.8);
    return carrier * envelope * 0.82;
  }),
  "bass.wav": render(1.05, (time) => {
    const attack = Math.min(1, time / 0.012);
    const envelope = attack * Math.exp(-time * 2.5) * fadeOut(time, 1.05, 0.7);
    const fundamental = oscillator(130.8128 * time);
    const second = oscillator(261.6256 * time) * 0.22;
    const sub = oscillator(65.4064 * time) * 0.26;
    return (fundamental + second + sub) * envelope * 0.68;
  }),
  "lead.wav": render(0.88, (time) => {
    const attack = Math.min(1, time / 0.008);
    const envelope = attack * Math.exp(-time * 3.2) * fadeOut(time, 0.88, 0.6);
    const phase = 130.8128 * time;
    const bright = oscillator(phase) + oscillator(phase * 2) * 0.34 + oscillator(phase * 3) * 0.14;
    return bright * envelope * 0.58;
  }),
  "chord.wav": render(1.25, (time) => {
    const attack = Math.min(1, time / 0.025);
    const envelope = attack * Math.exp(-time * 1.8) * fadeOut(time, 1.25, 0.55);
    const root = oscillator(130.8128 * time);
    const third = oscillator(164.8138 * time);
    const fifth = oscillator(195.9977 * time);
    return (root + third * 0.8 + fifth * 0.72) * envelope * 0.31;
  }),
  "texture.wav": (() => {
    let smoothedNoise = 0;
    return render(1.6, (time) => {
      smoothedNoise += (random() - smoothedNoise) * 0.018;
      const attack = Math.min(1, time / 0.09);
      const envelope = attack * fadeOut(time, 1.6, 0.8);
      const tone = oscillator(130.8128 * time + oscillator(0.7 * time) * 0.9);
      return (smoothedNoise * 1.7 + tone * 0.2) * envelope * 0.72;
    });
  })()
};

function encodeWav(floatSamples) {
  const dataLength = floatSamples.length * 2;
  const buffer = Buffer.alloc(44 + dataLength);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataLength, 40);

  floatSamples.forEach((sample, index) => {
    const integer = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    buffer.writeInt16LE(Math.round(integer), 44 + index * 2);
  });

  return buffer;
}

await mkdir(outputDirectory, { recursive: true });
await Promise.all(
  Object.entries(samples).map(([fileName, sampleData]) =>
    writeFile(`${outputDirectory}${fileName}`, encodeWav(sampleData))
  )
);
