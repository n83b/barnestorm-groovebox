# Barnestörm Groovebox UI Notes

## Purpose

Barnestörm Groovebox is a compact, eight-track sample-based groovebox designed for iPhone in landscape orientation.

The interface should feel like a dedicated hardware instrument rather than a conventional DAW. It should be immediate, tactile, minimal and easy to operate with two hands.

The main workflow is:

1. Select one of eight sample tracks.
2. Program that track using the shared row of 16 steps.
3. Adjust the selected track’s sound controls.
4. Switch patterns when needed.
5. Toggle Shift to access secondary actions such as muting tracks.

The final approved UI mockup should be treated as the primary visual reference. These notes define behaviour and clarify details that cannot be communicated by the static image alone.

---

# Core layout

The interface is divided into four horizontal sections:

1. Header and transport
2. Sample track selectors
3. Sixteen-step sequencer
4. Pattern selector and selected-track controls

The full interface must fit within an iPhone screen in landscape orientation without vertical scrolling.

The layout should also scale cleanly to larger phones, tablets and desktop browsers while preserving the same overall structure.

---

# Visual style

Use a dark, premium, hardware-inspired visual style.

The interface should use:

- Near-black background
- Slightly lighter raised control panels
- Soft borders and subtle shadows
- Orange as the primary active colour
- Green for active playback
- Individual accent colours for tonal tracks
- High-contrast white and light-grey text
- Dimmed controls for inactive or muted states
- Large touch targets
- Minimal animation
- Clear visual hierarchy

Avoid excessive gradients, decorative effects or DAW-style complexity.

The interface should feel polished and physical, with buttons and knobs appearing slightly raised from the surface.

All rotary knobs use horizontal dragging only. Dragging right increases the
value and dragging left decreases it; vertical movement has no effect. The
pack display temporarily replaces all pack information with a large,
formatted knob value throughout the drag.

Do not copy Roland branding, trademarks or exact product styling.

---

# Header

The header contains the following elements from left to right:

1. Barnestörm Groovebox logo
2. Pack banner
3. Tempo control
4. Swing control
5. Comp control
6. Play button
7. Stop button
8. Shift button

## Barnestörm Groovebox logo

Display the working Barnestörm Groovebox logo at the far left.

## Pack banner

The pack banner appears immediately after the Barnestörm Groovebox logo.

It uses two lines:

```text
PACK 2 • PUMPIN TECHNO
● 8 SAMPLES
```

The pack name should be the most prominent line.

The pack banner must not contain previous or next arrows. Tapping the pack name opens the save/load dialog so users can explicitly choose another pack.

The banner should display:

- Pack sequence number
- Pack name
- Number of samples

While a knob or step is being adjusted, all banner information is temporarily
hidden and replaced by one large, high-contrast formatted value centred in the
complete banner area. Releasing the control immediately restores the pack
number, pack name and sample count. This replacement must not change
the fixed header height.

The status dot may be green when the pack is available and fully downloaded.

Long pack names should scale or truncate gracefully rather than causing the banner to become taller.

## Tempo

Tempo is controlled by a rotary knob.

Its value is saved with the current pattern and restored when that pattern is
selected again.

Display the numeric BPM value directly below or near the knob.

Expected range:

```text
40–240 BPM
```

The current design shows:

```text
128.0
```

Tempo should support decimal values if the audio engine supports them.

## Swing

Swing is controlled by a rotary knob.

Its value is saved with the current pattern and restored when that pattern is
selected again.

Display the current percentage directly below or near the knob.

The current design shows:

```text
14%
```

A value of zero represents straight timing.

## Comp

Comp is a global sidechain-compression amount shown as a purple rotary knob.

Its value is saved with the current pattern and restored when that pattern is
selected again.

Display the current value as a percentage. A value of zero applies no ducking. As the value increases, each kick hit should progressively reduce the volume of the other seven sample tracks before they recover.

The prototype currently stores and displays this value; the audio behaviour will be implemented with the production audio engine.

## Play button

The Play button uses a green triangular play symbol.

When playback is stopped:

- The button should appear available but not brightly illuminated.

When playback is running:

- The button should glow green.
- The glow should pulse in time with the tempo.
- The pulse should follow quarter-note beats rather than every sequencer step.
- The animation should remain subtle and should not distract from step editing.

Respect the user’s reduced-motion preference by replacing the pulse with a steady active glow when reduced motion is enabled.

## Stop button

The Stop button uses a square symbol.

Pressing Stop should:

- Stop playback
- Reset the playhead to step 1
- Leave the current pattern unchanged

## Shift button

The Shift button is positioned at the far top-right so it can be toggled comfortably with the user’s right thumb.

Shift supports both latched and momentary operation. On desktop and laptop
mouse or trackpad input, one click toggles Shift lock. On phones, tablets and
other touch input, a double-tap enables Shift lock and a single tap disables it.
While unlocked, one quick tap has no persistent effect. Holding the button on
touch activates Shift only while the finger remains down so the other hand can
perform a secondary action.
Track selection and pattern changes must complete on touch release even while
the transport is running; they must not depend on a delayed synthetic click.

Its primary initial action is:

```text
Shift on + press a sample selector = mute or unmute that track
```

The Shift button should remain visibly illuminated while enabled. An orange
inset border around the complete app UI appears whenever Shift is active,
including both the latched lock state and a temporary touch hold. The temporary
border disappears when the Shift finger is released.

Other secondary Shift functions may be added later, but they should not be invented during the first implementation unless explicitly documented.

The selected-track controls also use Shift for per-step automation:

```text
Shift on + move any selected-track knob = record that value on the current playhead step
```

This applies to all nine selected-track controls. Recorded values belong to the
current pattern and track, override that pattern track's saved knob position
only on that step, and remain independent from automation in other patterns.
With Shift off, moving a knob saves its ordinary position for the selected
pattern and track, so returning to that pattern restores the last-set values.
If a parameter has automation on any step, the neutral dot at the base of that
knob lights using the knob's own accent colour.

To clear one parameter's automation:

```text
Hold Stop + move a selected-track knob = remove that knob's automation from every step
```

Double-tap or double-click Stop to lock automation-clear mode, move one or more
knobs without holding the button, then press Stop once to release the lock. The
double-tap must be detected directly from pointer input so it works in an
installed iPhone PWA without relying on the browser's `dblclick` event. While
locked, the Stop button remains visibly active and displays `CLEAR`.

While Stop lock is active:

- Tapping a sample selector clears that track's complete step sequence in the
  currently selected pattern.
- Tapping a pattern button clears all eight track sequences in that pattern.
- Pattern lengths and saved knob positions are preserved.
- The clicked sample or pattern is not selected, and Stop lock remains active
  so multiple sequences can be cleared.

Clearing automation affects only the selected pattern and track and does not
change that pattern track's saved knob position.

---

# Sample track selectors

There are eight large sample selector buttons in a single row.

Tracks 1–4 are drum samples:

1. Kick
2. Snare
3. Hi-hat
4. Percussion

Tracks 5–8 are chromatic samples:

5. Bass
6. Lead
7. Chord
8. Texture

Each sample button displays:

- Track number
- Waveform preview
- Track name
- A small track-colour indicator near the bottom

Do not use drum or instrument icons. Every track should show a waveform derived
from the actual loaded WAV sample. Generate it from the decoded audio data so a
newly loaded pack automatically displays its own eight waveform shapes.

## Track colours

Suggested track colours:

- Kick: orange
- Snare: neutral white or light grey
- Hi-hat: neutral white or light grey
- Percussion: neutral white or light grey
- Bass: blue
- Lead: cyan
- Chord: purple
- Texture: pink

The exact colours may be adjusted slightly for contrast and accessibility.

Colour must not be the only way to communicate state.

## Selecting a track

Tapping a sample selector makes that track the currently selected track.

The selected track should show:

- Bright outline
- Brighter waveform
- Brighter track name
- Brighter colour indicator
- Slightly raised or active appearance

Selecting a track changes:

- The events shown in the 16-step row
- The parameter values shown in the bottom control area
- The note-editing context for chromatic tracks

Selecting a track must not trigger the sample unless an explicit preview gesture is added later.

## Muting a track

To mute or unmute a track:

```text
Turn Shift on and tap the track’s sample selector
```

A muted track should:

- Become visibly dimmed
- Reduce waveform brightness
- Reduce label brightness
- Reduce its bottom colour indicator
- Display a small mute symbol
- Remain selectable for editing
- Retain all programmed steps

The selected-track outline must remain visible even when the selected track is muted.

Muted tracks should not produce sound during playback or export.

---

# Sixteen-step sequencer

There is one shared row of 16 sequencer steps.

The row displays the pattern for the currently selected track only.

Switching sample tracks replaces the visible step pattern with that track’s own sequence.

Each step includes:

- Step number
- Large touch button
- Active or inactive state
- Current-playhead state

## Step interaction

Tapping an inactive step activates it.

Tapping an active step deactivates it.

For drum tracks, an active step triggers the assigned one-shot sample.

For chromatic tracks, an active step triggers the sample using the note stored for that step.

The first implementation may assign a default note when a chromatic step is first enabled.

## Step states

Inactive step:

- Dark surface
- Subtle border
- Clearly tappable

Active step:

- Bright orange fill
- Strong contrast
- Slight glow or raised appearance

Current playhead:

- Highlight the current step number
- Show an orange outlined marker above the active position
- Keep active and inactive event states distinguishable underneath the playhead

The playhead advances from step 1 to step 16 and then loops.

Do not rely only on colour to show the current playhead.

## Beat grouping

Steps should be visually grouped into four beats:

```text
1–4
5–8
9–12
13–16
```

This may be achieved through slightly increased spacing or subtle divider emphasis.

Do not make the group separation visually heavy.

## Touch behaviour

Step buttons must be large enough for reliable use on an iPhone in landscape orientation.

Avoid requiring precise taps.

Prevent accidental browser zooming, text selection and drag behaviour while interacting with the sequencer.

---

# Pattern selector

The bottom-left panel is a pattern selector.

It replaces the larger waveform display from the earlier design.

Each bank displays eight visible patterns arranged as two rows:

```text
A1 A2 A3 A4
A5 A6 A7 A8
```

The narrow overflow button contains four vertical bank indicators. Pressing it
cycles through banks A–D without selecting or queueing a pattern in the newly
visible bank. The currently playing pattern continues until the user explicitly
presses a pattern button. If the visible bank does not contain that current
pattern, none of its eight pattern buttons appears selected.

The bank overflow button completes its action directly on touch release so bank
browsing remains responsive while the transport is running.

The bank colors are:

- Bank A: orange
- Bank B: blue
- Bank C: cyan
- Bank D: purple

The selected pattern outline, text and indicator bar use the current bank color.

All 32 pattern slots are implemented and store independent pattern state.

## Pattern behaviour

With Shift enabled, pattern buttons provide copy and paste:

1. Tap a pattern to mark it as the copy source.
2. Tap a different pattern to paste the complete pattern into that slot.

The copy-source pattern displays a subtle dashed inset outline and a small
`COPY` label. Tapping the source again cancels the pending copy. The pasted
pattern receives all eight tracks, including steps, notes, velocity, automation,
track lengths and saved knob positions. Its pattern name and slot remain
unchanged. Shift stays enabled after pasting.

Pattern button fill communicates sequence occupancy:

- The currently active pattern uses its bank colour, whether populated or empty.
- Inactive populated patterns use the normal grey treatment.
- Empty patterns use a visibly darker grey treatment.
- Clearing a pattern with Stop lock changes it to the empty treatment immediately.

A pattern counts as populated when at least one step on any track is active.
The bank overflow control always browses without changing the active pattern,
allowing cross-bank selection, copy, paste and clear actions.

Selecting a pattern should load that pattern’s complete state for all eight tracks.

A pattern contains:

- Step states
- Chromatic note data
- Per-step data that is implemented
- Pattern length
- Any future per-pattern settings

The selected pattern should have:

- Orange outline
- Orange label
- Small orange indicator bar

Inactive pattern buttons should remain clearly visible but subdued.

The pattern panel should display:

```text
16 STEPS
```

This describes the current pattern length.

The small indicators beneath the pattern selector may represent pattern position, chained patterns or future expansion. Do not make them interactive in the first version unless their behaviour is explicitly implemented.

## Pattern switching during playback

When switching patterns during playback, use a predictable musical transition.

Preferred behaviour:

- Queue the new pattern
- Switch at the end of the current 16-step cycle

Clearly indicate both:

- The currently playing pattern
- A queued pattern waiting to begin

For the earliest prototype, immediate switching is acceptable if queued switching has not yet been implemented, but this limitation should be documented.

---

# Selected-track controls

The bottom-right area contains rotary controls for the currently selected sample track.

The controls appear in this order:

1. Volume
2. Pan
3. Pitch
4. Start
5. End
6. Filter
7. Resonance
8. FX
9. FX Depth

Changing the selected sample track updates every knob to that track’s stored value.

Each track maintains its own independent settings.

## Knob interaction

Knobs should support touch, pointer and mouse input.

Preferred interactions:

- Drag left or right to adjust; ignore vertical movement
- Fine adjustment with a modifier key on desktop
- Double-tap or double-click to restore the default value
- Temporarily replace the complete pack banner with a large formatted
  value while editing

Do not require users to rotate their finger in a circle around the knob.

Knobs should have:

- Clear position indicator
- Visible value arc
- Subtle fixed marks at the minimum, center and maximum positions
- A small neutral dot at the bottom of the knob
- Accessible label
- Keyboard adjustment support
- An accessible numeric value

## Volume

Controls the selected track’s output level.

Suggested range:

```text
0%–100%
```

Use a sensible default that avoids clipping when all tracks play simultaneously.

## Pan

Controls stereo position.

Suggested range:

```text
L100 – C – R100
```

Default:

```text
C
```

Pan uses a bipolar value arc. The center position has no directional fill; left values fill from center toward the left endpoint and right values fill from center toward the right endpoint.

## Pitch

Controls playback pitch.

For drum tracks, use semitone transposition.

For chromatic tracks, Pitch acts as an overall track transpose in addition to each step’s note.

Suggested range:

```text
-24 to +24 semitones
```

Default:

```text
0
```

## Start

Controls the sample start point.

Suggested display:

```text
0%–100%
```

The start point must never move beyond the end point.

## End

Controls the sample end point.

Suggested display:

```text
0%–100%
```

The end point must never move before the start point.

## Filter

Controls filter cutoff.

The label beneath the knob shows the current cutoff percentage:

```text
0%–100%
```

The compact selector beneath the Filter knob offers:

```text
LPF
HPF
```

Exactly one filter type is active for each track in each pattern. Changing
patterns or tracks restores its saved choice.

## Resonance

Controls filter resonance.

Keep the maximum range musically useful and protect against extreme gain spikes.

## FX

The compact selector beneath the FX knob offers:

```text
Delay
Reverb
Chorus
Distortion
```

Exactly one effect is active for each track in each pattern. Changing patterns
or tracks restores its saved choice. The FX knob shapes the selected effect.
The native selector must remain open and usable while the sequence is playing;
playhead rendering must not dismiss it on touch devices.

## FX Depth

Controls the amount or intensity of the selected effect.

Its meaning may depend on the selected effect, but it should always move from minimal to maximum effect.

The FX and FX Depth controls use a purple accent to distinguish them from standard track parameters.

---

# Step Editing (Notes & Velocity)

The sequencer is designed around direct manipulation.

Rather than opening separate editors or displaying a permanent piano keyboard, note and velocity editing are performed directly on the sequencer using simple touch gestures.

This keeps the entire workflow on a single screen and reinforces the feeling of using a compact hardware instrument.

## Step Interaction

### Tap

A quick tap toggles the selected step on or off.

- Inactive step → Active
- Active step → Inactive

This behaviour is identical for both drum and chromatic tracks.

### Hold

Pressing and holding an active step for approximately 250 ms enters **Step Edit Mode**.

Once Step Edit Mode is active, the user can adjust musical properties without lifting their finger.

The selected step should become visually highlighted while editing.

---

# Chromatic Track Note Editing

Tracks 5–8 support chromatic playback.

While holding an active chromatic step, dragging **left or right** changes the note assigned to that step.

The interaction should feel similar to turning a hardware encoder while keeping the user's finger on the step.

## Note Preview

As the user slides horizontally:

- The current note plays immediately.
- Notes update continuously while dragging.
- Playback latency should be extremely low.
- Only one preview note should sound at a time.

This allows users to build melodies by ear without opening another editor.

## Visual Feedback

While editing:

- The selected step remains highlighted.
- A large transient value replaces all pack information.
- The value displays the currently selected note.

For example:

```text
C2
D#2
F3
A3
C4
```

The transient value disappears immediately when the user releases their finger.

## Note Range

The initial implementation should support at least two octaves.

Suggested default range:

```text
C2 → C4
```

This range should be configurable so it can be expanded later.

If the step already contains a note, editing begins from that note rather than resetting to a default.

In a fresh or cleared pattern, each chromatic step begins at that track's root
note declared by the active pack manifest.

When activating an untouched chromatic step in a non-empty track sequence, copy
the track's most recently entered or edited note into that step. If the sequence
is empty, use the manifest root note. A deactivated step retains its own note
data and restores that note when activated again.

---

# Velocity Editing

Velocity editing is available on **all eight tracks**, including both drum and chromatic tracks.

While holding an active step, dragging **up or down** adjusts the velocity stored for that step.

This allows expressive programming without adding additional controls or editing screens.

## Velocity Feedback

While adjusting velocity, update the displayed value and step intensity without
auditioning or retriggering the sound. Chromatic note changes continue to
audition immediately, but a velocity-only drag remains silent.

## Velocity Range

Suggested range:

```text
1–127 MIDI velocity
```

The UI may internally display velocity as either:

- MIDI value (1–127), or
- Percentage (0–100%)

Internally, MIDI velocity values should be preserved.

## Visual Feedback

While editing:

- A large transient velocity value replaces all pack information.

For example:

```text
Vel 96
```

As velocity changes, the appearance of the step should also update to communicate its intensity.

Examples include:

- Increased brightness for higher velocities.
- Increased fill height within the step.
- Stronger glow for louder notes.

Velocity should never be represented by colour alone.

---

# Combined Gesture Editing

Horizontal and vertical gestures work together.

```text
Tap
→ Toggle step

Hold
→ Enter Step Edit Mode

Hold + Left / Right
→ Change note (chromatic tracks only)

Hold + Up / Down
→ Change velocity (all tracks)
```

Diagonal movement should allow both note and velocity to be adjusted simultaneously.

For example:

- Drag right while moving upward to create a higher, louder note.
- Drag left while moving downward to create a lower, softer note.

The interface should smoothly update both values during the same gesture.

---

# Drum Tracks

Drum tracks (1–4) do not support note editing.

Holding a drum step allows velocity editing only.

Horizontal movement on drum tracks should have no effect unless another feature is introduced in a future version.

---

# Design Philosophy

This interaction is intentionally minimal.

A complete pattern should be programmable using only:

- Track selection
- Step entry
- Hold-and-drag editing

No secondary editing screens or permanent piano keyboard should be required.

The goal is for users to build rhythms and melodies quickly while keeping their focus entirely on the sequencer, reinforcing the philosophy that Barnestörm Groovebox is a compact musical instrument rather than a traditional DAW.

---

# Per-Track Pattern Length (Last Step)

Each track has its own independent pattern length.

By default, every track plays a full 16-step pattern.

Users can shorten the pattern length for an individual track to create evolving rhythms and polyrhythms without affecting the other tracks.

## Interaction

To change a track's pattern length:

1. Select the desired track.
2. Turn **Shift** on.
3. Tap the step that should become the final step of the pattern.

The tapped step becomes the **Last Step** for that track.

For example:

```text
Shift + Step 12
```

Results in:

```text
Steps 1–12  → Active
Steps 13–16 → Disabled
```

Playback for that track loops back to Step 1 after Step 12.

All other tracks continue using their own independent pattern lengths.
Track loops are calculated from a continuous shared transport tick, so non-divisors of 16 such as 10 steps repeat as 1–10, 1–10 without alternating partial cycles.

## Visual Feedback

The current Last Step should be clearly identifiable.

Suggested behaviour:

- The Last Step displays a subtle end-of-pattern marker.
- Steps after the Last Step become dark grey.
- Disabled steps remain visible but cannot be edited or triggered until they become active again.
- The playhead skips disabled steps for that track.

Example:

```text
■■■■■■■■■■■■░░░░
			 ▲
		 Last Step
```

Where:

- **■** = Active pattern area
- **░** = Disabled steps

## Extending a Pattern

To increase the pattern length:

- Turn **Shift** on.
- Tap a later step.

All steps up to the newly selected Last Step become active again.

Example:

```text
Current Last Step = 8

Shift + Step 16

Result:

■■■■■■■■■■■■■■■■
```

## Editing Disabled Steps

Steps beyond the current Last Step cannot be toggled or edited until they become part of the active pattern again.

This prevents accidental programming of steps that will never be played.

## Design Rationale

Per-track pattern lengths are a core creative feature rather than an advanced option.

They encourage:

- Polyrhythms
- Phase-shifting patterns
- Evolving grooves
- Minimal techno sequencing
- Generative rhythmic variation

The feature should remain discoverable through the simple gesture:

```text
Shift on + Tap Step
```

No additional menus or dedicated pattern-length controls should be required.

---

# Responsive behaviour

The primary target is an iPhone in landscape orientation.

On iPhone, iPad and Android, the instrument must be launched from an installed
Home Screen app. Opening it in a normal mobile browser tab shows a focused
installation screen and does not initialise the instrument. Desktop browsers
remain usable without installation for development, keyboard control and
testing.

Use the device safe-area insets so controls are not obscured by:

- Dynamic Island
- Camera cutout
- Rounded screen corners
- Home indicator areas

The interface should avoid vertical scrolling at the primary target size.

At smaller widths:

- Preserve all eight track selectors
- Preserve all 16 steps
- Reduce spacing before reducing touch-target size
- Reduce decorative labels before removing functional controls
- Allow some parameter controls to use horizontal scrolling only as a last resort

At larger widths:

- Increase spacing and panel widths
- Do not radically rearrange the interface
- Preserve the hardware-style horizontal structure

Do not convert the interface into a conventional stacked mobile layout.

---

# Interaction and feedback

Every interactive control should provide immediate visual feedback.

Buttons should have distinct states for:

- Default
- Hover where supported
- Focus
- Pressed
- Active
- Disabled
- Muted where applicable

Audio actions should feel immediate.

Avoid long easing animations.

Use subtle transitions of approximately:

```text
80–150 ms
```

The play pulse and playhead are the only persistent animated elements during playback.

---

# Accessibility

The interface must support:

- Keyboard navigation on desktop
- Visible focus states
- Screen-reader labels
- Sufficient colour contrast
- Touch targets of approximately 44 × 44 CSS pixels where practical
- Reduced-motion preferences
- State indicators that do not rely solely on colour
- Numeric or text alternatives for knob values

The muted state must include both dimming and a mute symbol.

The selected state must include an outline or structural change, not colour alone.

---

# State and persistence

The UI should preserve:

- Selected track
- Selected pattern
- Track mute states
- Track parameter values
- Pattern step data
- Chromatic step notes
- Tempo
- Swing
- Current project data

Stopping playback must not clear or reset the project.

Refreshing or reopening the installed PWA should restore the last saved project when appropriate.

---

# Explicitly excluded from the first UI

Tapping the active pack name opens a compact dialog with **Save pack** and
**Load pack** actions. Save asks for a parent directory and creates a new
self-contained folder containing all pattern data, settings, the manifest and
all eight sounds. Load asks for one of those folders and replaces the current
pattern state after verifying every sound. On browsers without folder access,
the same workflow uses one portable `.wgbpack` file instead. On iPhone and iPad,
the save action is labelled **Save to Files** and opens the native share sheet;
the status text tells the user to choose **Save to Files**, then Downloads. This
does not add general pack browsing or user-sample import to the instrument.

Do not add the following to the main interface unless requested later:

- User sample import
- Sample browser
- Pack browser
- Previous and next pack arrows
- Mixer screen
- Arrangement mode
- Song mode
- Automation lanes
- Recording controls
- User accounts
- Social feed
- Upload controls
- Community voting
- Plugin controls
- Large piano keyboard
- Settings cog
- Mute and solo knobs or dedicated buttons
- Extra transport controls
- More than one visible sequencer row

The simplicity of the interface is intentional.

---

# Interaction summary

```text
Tap sample selector
→ Select that track

Shift on + tap sample selector
→ Mute or unmute that track

Hold Shift on touch + tap another control
→ Use Shift temporarily until the Shift finger is released

Shift on + tap pattern, then another pattern
→ Copy the first complete pattern into the second slot

Tap step
→ Enable or disable the step for the selected track

Tap pattern
→ Select or queue that pattern

Turn track parameter knob
→ Change the selected track only

Press Play
→ Start looping the current pattern

Press Stop
→ Stop playback and reset the playhead

Double-tap or double-click Stop
→ Lock automation-clear mode; click Stop once to unlock

Stop lock + tap sample selector
→ Clear that track's sequence in the current pattern

Stop lock + tap pattern
→ Clear all eight track sequences in that pattern

Press Space from the page, a track knob, or the Play button
→ Start or stop playback

Select chromatic step note-edit action
→ Change the note stored on that step
```

---

# Implementation priority

Codex should implement the interface in this order:

1. Static layout matching the approved mockup
2. Responsive iPhone landscape sizing
3. Track selection
4. Shared 16-step sequencer
5. Playhead animation
6. Play and stop behaviour
7. Tempo
8. Swing
9. Shift plus track mute behaviour
10. Pattern selection
11. Selected-track parameter controls
12. Chromatic step note editing
13. Persistence
14. Accessibility refinement

The interface should remain usable after every milestone.

Where these notes and the approved mockup appear to conflict, preserve the interaction rules in these notes and preserve the visual proportions and styling of the mockup as closely as practical.
