# Weekly Groovebox Roadmap

## Milestone 1 — Interactive instrument shell

Status: complete

- Approved single-screen layout
- Responsive iPhone landscape sizing and safe areas
- Track selection
- Shared 16-step sequencer
- Visual playhead and transport
- Tempo and swing
- Toggle Shift interactions
- Track mute and per-track last step
- Four color-coded pattern banks with eight patterns each and queued switching
- Per-track parameter controls
- Hold-and-drag note and velocity editing
- Local project persistence
- Initial accessibility states

## Milestone 2 — Sample playback

Status: complete

- Define the weekly pack manifest format
- Add eight licensed development samples
- Load and decode samples with Web Audio
- Schedule sixteenth-note playback ahead of time
- Apply track mute and velocity
- Apply chromatic pitch and track transpose
- Add low-latency preview during step editing
- Handle audio context resume and device interruption

Exit criterion: pressing Play produces a stable, looping groove whose audible state matches the sequencer.

## Milestone 3 — Sound shaping

Status: complete

- Sample start and end
- Per-track gain and stereo pan
- Low-pass filter and bounded resonance
- Delay and FX depth
- Kick-triggered sidechain compression
- Click-free live parameter changes
- Gain staging and limiter protection
- Shift-recorded per-step automation for all nine track controls

## Milestone 4 — Offline PWA

- Web app manifest and product icon set — complete
- Mobile installed-app launch gate — complete
- Service-worker application shell — complete
- IndexedDB weekly pack cache — complete
- Offline startup with the most recent downloaded pack — complete
- Pack download and integrity status — complete
- Install and resume validation on iOS

## Milestone 5 — Project and export reliability

- Explicit project schema migrations
- Multiple local projects
- Self-contained pattern pack save/load — complete
- Render/export without muted tracks
- WAV export
- Recovery tests for interrupted saves

## Milestone 6 — MVP refinement

- Real-device two-handed interaction testing
- VoiceOver and keyboard audit
- Contrast and reduced-motion audit
- Performance profiling on supported iPhones
- Pack rollover and countdown behaviour — complete
- Final visual polish against the approved mockup

## Not in MVP

- User samples
- Pack browsing
- Accounts or social features
- Arrangement/song mode
- Automation lanes
- Plugin hosting
- Community upload and voting
