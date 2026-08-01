# Weekly Groovebox Architecture

## Current approach

The first prototype is a dependency-free browser application. This keeps the interaction model easy to inspect and lets the project validate its core instrument workflow before choosing an application framework or production audio stack.

The application is split into three layers:

1. `web/state.mjs` owns project data and state transitions.
2. `web/app.mjs` renders controls and coordinates input, timing and persistence.
3. `web/styles.css` owns responsive layout and physical control styling.

The DOM remains semantic: tracks, steps, patterns and transport actions are buttons, while continuous parameters are native range inputs beneath their visual knob treatment.

## State model

Global project state contains:

- Selected track and pattern
- Queued pattern
- Tempo, swing and global sidechain-compression amount
- Eight mute states
- Per-track parameter values
- Four pattern banks with eight patterns each

Each pattern owns eight tracks. Each pattern track owns:

- A last-step value from 1–16
- Nine saved knob positions
- Sixteen step events

Each event currently stores:

- Active state
- MIDI note
- MIDI velocity
- Optional per-parameter automation values

Each pattern track stores its own nine knob positions. Moving a knob with Shift
off updates those pattern-local values, so switching away and back restores the
track exactly as it was last set in that pattern.

With Shift toggled on, moving one of the nine selected-track knobs writes that
parameter to the selected track's current playhead step. Playback merges those
step values over the pattern track's saved knob positions before scheduling the
audio nodes and any new sample voice. A lit base dot on a knob indicates that
the parameter has automation on at least one step of the selected track and
pattern. Holding Stop while moving that knob removes its automation from all
steps of that track and pattern. Mouse users can double-click Stop to latch this
clearing modifier and click it once to release the lock. While latched, selecting
a sample clears that track's sequence in the current pattern, and selecting a
pattern clears all eight of its track sequences. These sequence clears preserve
pattern lengths and saved knob positions.

## Timing

The instrument uses a Web Audio look-ahead clock. A 25 ms scheduler fills the
next 100 ms of the `AudioContext` timeline. Each scheduled interval represents
a sixteenth note:

```text
60,000 ms / BPM / 4
```

Swing alternately lengthens and shortens adjacent sixteenth-note intervals while preserving the pair's total duration. The shared transport uses a continuously increasing tick, and each track derives its own playhead with `tick % track length`. This lets every shortened track loop consistently and independently while pattern changes remain queued until each shared 16-step boundary.

Scheduled UI callbacks carry the same tick and audio timestamp as each sound,
so the visible playhead follows the audio timeline instead of acting as its
clock. Timing, event collection and playback-rate calculations live in
`web/sequencer.mjs` and are deterministic under Node tests.

## Persistence

The complete serialisable project state is stored in `localStorage` under a
pack-scoped versioned key. Each project records its immutable pack id. At weekly
rollover, the previous weekly draft remains stored under its original pack id
and a fresh draft is opened for the newly delivered pack. There is no archive
UI in the MVP, but the saved state remains available for that future feature.

Restore logic clamps ranges and fills missing values from the current defaults
so malformed or older partial data cannot break the instrument. The original
unscoped project key is treated as legacy state and is attached to the first
successfully delivered pack without losing edits.

Weekly audio packs use a separate IndexedDB repository. A small, revalidated
`assets/packs/current.json` file points to an immutable pack manifest. The app
downloads all eight samples, verifies byte lengths and SHA-256 hashes, and then
writes the manifest and sample buffers as one IndexedDB record. This makes pack
availability atomic: an interrupted download cannot displace the last complete
pack.

At launch the current pointer is preferred. When the network or current pack is
unavailable, the project-pinned cached pack is used, followed by the newest
complete cached pack as a final fallback. Foreground checks may pre-download a
new pack, but an open session never changes samples underneath the project.

## Fixed-ratio layout

The instrument is authored on a 1024 × 576 logical canvas. A single uniform scale is calculated from the available safe-area width and height, so the rendered interface always remains exactly 16:9. Wider iPhone landscape viewports receive symmetrical side letterboxing instead of stretching the interface.

Viewport units inside the instrument use container-relative units based on the logical canvas. This prevents typography, spacing and controls from changing proportions as the outer canvas scales. The UI uses CSS surfaces, text and SVG waveforms, allowing the browser to rasterise the final composition at the device's native Retina pixel density.

The interface uses four fixed functional bands:

1. Header and transport
2. Eight track selectors
3. Shared sequencer
4. Patterns and selected-track controls

Safe-area environment values protect the layout around rounded corners, the Dynamic Island and home indicator. A portrait-only orientation notice replaces the instrument on narrow phones.

## Installed-app launch gate

Mobile browsers load a small bootstrap module before the instrument. On iPhone,
iPad and Android it starts the groovebox only when the page is running in
standalone display mode. A normal mobile browser tab instead shows platform
appropriate installation instructions, while desktop browsers remain available
for development and keyboard use. Service-worker registration remains active on
the installation screen so supported browsers can offer their native install
prompt.

Production builds calculate a 12-character SHA-256 fingerprint from the complete
`web/` source tree. The build replaces every development asset-version query
and the service-worker shell cache name with that fingerprint. Any code, style,
icon or pack-source change therefore produces a new immutable release identity
without manually incrementing cache versions. An already open PWA session keeps
running its loaded code; the generated release is applied after deployment and
the user's next full launch.

## Audio integration boundary

`web/audio-engine.mjs` keeps Web Audio nodes behind a small interface:

```text
loadPack(pack)
start(transportState)
stop()
preview(track, note, velocity)
setTrackParameters(track, parameters)
setMuted(track, muted)
setCompressor(amount)
```

`start()` receives callbacks that expose the current serialisable state and
deliver audio-timed UI ticks. The engine owns decoded buffers, scheduled
sources and its master gain; none of those nodes enter project state. The
context resumes from direct play/edit gestures and resynchronises its scheduling
horizon after an interruption.

Each track owns a persistent Web Audio strip:

```text
voice → low-pass filter → stereo pan → track gain → mute → sidechain gain
                                               ↘ delay send/feedback ↗
```

The persistent nodes let volume, pan, cutoff, resonance and delay changes use
short audio-parameter ramps instead of rebuilding live voices. Sample start and
end remain per-voice playback bounds, with a short release ramp at the selected
end point. The FX control shapes delay time and feedback while FX Depth controls
the delay send.

Kick events schedule gain ducking on the other seven track strips using the
global Comp amount. All strips feed a conservatively staged master bus followed
by a fast Web Audio dynamics compressor configured as a safety limiter.

Weekly packs use a JSON manifest containing pack metadata and exactly eight
ordered track entries. The first four must be drums and the last four chromatic;
chromatic entries declare a MIDI root note. Sample URLs resolve relative to the
manifest, so a future pack cache can replace delivery without changing the
engine contract.

The audio engine accepts either manifest URLs for direct development use or a
delivered manifest with eight in-memory sample buffers. It does not know whether
those buffers came from the network or IndexedDB.

## Testing strategy

Pure state transitions are covered with Node's built-in test runner. Browser verification checks:

- No overflow at the primary landscape viewport
- Control visibility and touch sizing
- Track and step interaction
- Transport state
- Queued pattern state
- Persistence after reload

Audio-engine tests use deterministic scheduling units separate from browser
timers plus a fake AudioContext integration test. Real-browser verification
covers manifest fetch/decode, context resume, transport state and audible voice
scheduling.
