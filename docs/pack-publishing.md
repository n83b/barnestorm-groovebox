# Publishing a pack

Packs are published with the application as immutable static assets. The
installed app checks `web/assets/packs/current.json` when it launches and when
it returns to the foreground. A foreground check downloads a new pack for the
next launch without changing the pack in the current session.

## 1. Create the pack directory

Use a unique, year-qualified directory name:

```text
web/assets/packs/2026-week-32-found-signals/
```

Place exactly eight WAV files in it:

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

Do not replace a previously published directory. Old projects retain its pack
id and may need those exact files again.

## 2. Generate and validate the pack

From the repository root, run:

```sh
npm run create:pack -- 2026-week-32-found-signals
```

This command:

- Infers calendar year `2026`, ISO calendar week `32` and the name `Found Signals` from the folder.
- Assigns the next visible product pack number from the current published pack.
- Requires all eight standard sample filenames.
- Verifies that every sample is a WAV file.
- Calculates every byte length and SHA-256 digest.
- Creates or replaces the pack's `manifest.json`.
- Calculates the Monday-to-Monday ISO week window in UTC.
- Updates `web/assets/packs/current.json` to activate the pack.
- Validates the complete result.

Chromatic samples default to root note MIDI 48 (C3), and the default license is
`All rights reserved`. Override the generated values when necessary:

```sh
npm run create:pack -- 2026-week-32-found-signals \
  --name "Found Signals" \
  --license "CC0-1.0" \
  --root-note 48 \
  --pack-week 1
```

`--root-note` applies to Bass, Lead, Chord and Texture. If those samples use
different natural pitches, run the generator and then edit their individual
`rootNote` values in `manifest.json` before running `npm run validate:pack`.

The ISO week in the directory controls the Monday-to-Monday release window. It
is deliberately separate from the `week` shown in the app. Product pack numbers
start at 1 and increment from the current published manifest. Re-running the
generator for an existing pack preserves its number. Use `--pack-week` only for
an intentional correction or reset.

## 3. Review the generated files

The command creates the pack manifest and updates the pointer automatically:

```json
{
  "schemaVersion": 1,
  "packId": "2026-week-32-found-signals",
  "manifestUrl": "./2026-week-32-found-signals/manifest.json",
  "releasedAt": "2026-08-03T00:00:00.000Z",
  "expiresAt": "2026-08-10T00:00:00.000Z"
}
```

Review the generated pack name, license and chromatic root notes. Release and
expiry timestamps are UTC. The pack id exactly matches the folder name.

## 4. Validate and deploy

```sh
npm run validate:pack
npm run check
npm run build
```

Deploy the resulting `dist/` directory using the configured static hosting
provider. The build copies the pack directory and `current.json` into
`dist/client/assets/packs/`.

Clients do not receive an unsolicited push notification. They revalidate the
small `current.json` pointer at launch or on foreground, download and verify the
eight samples, and commit the complete pack to IndexedDB. If anything fails,
the last complete downloaded pack remains usable.

## Rolling back

Point `current.json` back to the previous immutable pack and redeploy. Clients
that check after the rollback will resolve that pack without any asset changes.
