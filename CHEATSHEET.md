# Barnestörm Groovebox Cheatsheet

## Create a pack

Create a folder under `web/assets/packs/` using this exact format:

```text
YYYY-week-WW-pack-name
```

Example:

```text
web/assets/packs/2026-week-32-found-signals/
```

Add these exact filenames:

```text
kick.wav
snare.wav
hi-hat.wav
perc.wav
bass.wav
lead.wav
chord.wav
texture.wav
```

Use PCM WAV files at 44.1 or 48 kHz. Trim unnecessary silence and keep files
reasonably small.

Generate, activate and validate the pack:

```sh
npm run create:pack -- 2026-week-32-found-signals
```

This creates the pack's `manifest.json`, calculates file sizes and SHA-256
hashes, sets the UTC release window, assigns the next product pack number, and updates
`web/assets/packs/current.json`.

The `WW` in the folder is the ISO calendar week used as publishing metadata. The
app's visible `PACK` number is a separate sequence: the first pack is Pack 1,
then each new pack becomes Pack 2, Pack 3, and so on. Re-running the command for
an existing pack keeps its assigned number.

Only run `create:pack` when the pack is ready to become the current pack.

## Optional metadata

The folder slug becomes the display name:

```text
2026-week-32-found-signals → Found Signals
```

Override generated metadata when needed:

```sh
npm run create:pack -- 2026-week-32-found-signals \
  --name "Found Signals" \
  --license "CC0-1.0" \
  --root-note 48 \
  --pack-week 1
```

Defaults:

- License: `All rights reserved`
- Bass, Lead, Chord and Texture root note: MIDI `48` (C3)
- Pack week: current published pack number plus one

Use `--pack-week` only to correct or deliberately reset the visible sequence.

`rootNote` is the note that plays the chromatic sample at its original pitch.
If the four chromatic samples have different root notes, generate the pack and
then edit their individual `rootNote` values in `manifest.json`.

## Validate the current pack

```sh
npm run validate:pack
```

Validation checks:

- Pointer and manifest IDs match
- Exactly eight tracks in the required order
- Every WAV exists and has a valid WAV header
- File sizes and SHA-256 hashes match
- Drum and chromatic track types are correct

Run this again after manually editing a manifest or replacing a WAV.

## Test and preview locally

Run the complete project checks:

```sh
npm run check
```

Start the local app:

```sh
npm run dev
```

Open:

```text
http://localhost:4173
```

## Build and publish

```sh
npm run validate:pack
npm run check
npm run build
```

Deploy the generated `dist/` directory through the configured static host.
Clients check `current.json` when the app launches or returns to the foreground.

`npm run build` automatically generates a content fingerprint for JavaScript,
CSS and the service-worker cache. Do not manually increment `?v=` values or the
shell cache name.

Do not rename, replace or delete previously published pack directories. Saved
projects remain pinned to their original pack IDs.

## Roll back a pack

Edit `web/assets/packs/current.json` so it points to the previous pack, then:

```sh
npm run validate:pack
npm run build
```

Deploy `dist/` again. The immutable pack directories themselves do not need to
change.

## Common failures

### Missing required sample

Check that all eight filenames match exactly, including `hi-hat.wav`.

### Not a valid WAV file

Re-export the sample as PCM WAV rather than renaming another audio format.

### Unexpected file size or failed integrity check

The WAV changed after the manifest was generated. Run `create:pack` again, or
restore the original WAV.

### Invalid folder name

Use a two-digit ISO week and lowercase hyphenated name:

```text
2026-week-03-frozen-circuits
```

### Wrong chromatic pitch

Correct the affected track's MIDI `rootNote` in its generated `manifest.json`,
then run `npm run validate:pack`.

## Useful files

- `web/assets/packs/current.json` — selects the current pack
- `web/assets/packs/<pack-id>/manifest.json` — generated pack metadata
- `docs/pack-publishing.md` — detailed publishing workflow
- `tools/create-pack.mjs` — pack generator
- `tools/validate-pack.mjs` — pack validator
