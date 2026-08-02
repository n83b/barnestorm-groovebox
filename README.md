# Weekly Groovebox

A focused eight-track, sample-based groovebox built around one shared weekly sound pack.

This repository contains the interactive web prototype, including its first
Web Audio sample engine. It follows the approved UI in `ui/ui-mockup-final.png`
and the behaviour defined in `docs/ui-interaction-spec.md`.

## Run locally

The prototype has no runtime dependencies and no build step:

```sh
python3 -m http.server 4173 -d web
```

Then open `http://localhost:4173`.

For the intended experience, use a landscape viewport. The instrument uses a fixed 1024 × 576 logical canvas and scales uniformly at every screen size, preserving a 16:9 aspect ratio. Wider iPhone displays use symmetrical side letterboxing.

## Tests

The state model uses Node's built-in test runner:

```sh
node --test tests/*.test.mjs
```

## Create a weekly pack

Create a year-qualified folder under `web/assets/packs/`, add the eight standard
WAV filenames, then run:

```sh
npm run create:pack -- 2026-week-32-found-signals
```

The command generates the manifest, calculates integrity metadata, assigns the
next visible product pack number, updates the current-pack pointer and validates the result. See
`docs/pack-publishing.md` for naming, metadata overrides and deployment.

## Implemented

- Responsive, single-screen groovebox layout
- Fixed 16:9 presentation with Retina-safe CSS and SVG rendering
- Eight track selectors with generated waveform previews
- Shared 16-step sequencer with per-track state
- Four color-coded banks with eight patterns each, per-bank selection memory and queued switching during playback
- Play, stop, playhead and swing-aware timing
- Manifest-driven loading and decoding of the eight-sample weekly pack
- Integrity-checked weekly delivery through a revalidated current-pack pointer
- IndexedDB sample-pack caching and offline audio startup
- Pack-pinned weekly drafts with non-destructive rollover
- Content-fingerprinted production assets and automatic PWA cache invalidation
- Web Audio look-ahead scheduling with an audio-synchronised playhead
- Velocity, mute, chromatic note and per-track transpose playback
- Low-latency note and velocity preview while editing active steps
- Audio context resume and interruption recovery
- Momentary Shift modifier
- Shift + track mute
- Shift + step per-track pattern length
- Per-track volume, pan, pitch, sample bounds, filter and FX controls
- Hold-and-drag step velocity and chromatic note editing
- Keyboard-accessible controls and reduced-motion support
- Local project persistence

The included Broken Machinery pack contains original, procedurally generated
CC0 development samples. Regenerate them with:

```sh
npm run generate:samples
```

## Project map

- `web/index.html` — semantic application shell
- `web/styles.css` — responsive hardware-inspired presentation
- `web/app.mjs` — rendering, gestures, transport and persistence
- `web/audio-engine.mjs` — Web Audio loading, voices, preview and look-ahead clock
- `web/pack-delivery.mjs` — current-pack resolution, integrity checks and IndexedDB storage
- `web/sequencer.mjs` — deterministic timing, event and pitch calculations
- `web/assets/packs/current.json` — pointer to the currently published immutable pack
- `web/assets/packs/<pack-id>/manifest.json` — weekly pack metadata and sample map
- `web/layout.mjs` — 1024 × 576 scaling calculations
- `web/state.mjs` — project data model and state operations
- `tests/state.test.mjs` — state-model regression tests
- `tests/sequencer.test.mjs` — deterministic scheduler tests
- `tests/audio-engine.test.mjs` — audio engine integration tests with a fake context
- `tools/create-pack.mjs` — generate and activate a pack from eight named WAV files
- `tools/validate-pack.mjs` — validate the current pointer, manifest and sample integrity
- `docs/product.md` — product principles
- `docs/ui-interaction-spec.md` — interaction contract
- `docs/architecture.md` — implementation architecture
- `docs/pack-publishing.md` — manual weekly pack publishing workflow
- `docs/roadmap.md` — milestone plan
