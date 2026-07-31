# Weekly Groovebox

## Vision

Weekly Groovebox is a simple, eight-track sample-based groovebox inspired by compact hardware instruments.

Its purpose is to encourage creativity through limitation.

It is **not** intended to compete with full Digital Audio Workstations (DAWs). Instead, it is designed to be an instrument that users can pick up and begin creating music within seconds.

Every design and engineering decision should support speed, simplicity and musical enjoyment.

---

# Core Philosophy

Most modern music software gives users unlimited sounds, unlimited tracks and endless options.

Weekly Groovebox intentionally does the opposite.

Every user around the world receives exactly the same eight samples each week.

Those eight samples become the user's complete sound palette for that week.

Rather than searching through thousands of sounds, users are encouraged to explore how much music can be created from a very small collection of carefully chosen samples.

The creative limitation is the defining feature of the product.

---

# Product Goals

The application should feel:

- Immediate
- Fun
- Playful
- Fast
- Tactile
- Inspiring
- Hardware-like
- Focused

The application should **not** feel like:

- Ableton Live
- Logic Pro
- FL Studio
- Cubase
- A desktop DAW
- A complex production environment

Users should spend their time making music, not configuring software.

---

# Weekly Sample Packs

Every week a new sample pack becomes available.

Each pack contains exactly eight samples.

## Drum Tracks

1. Kick
2. Snare
3. Hi-hat
4. Percussion

## Chromatic Tracks

5. Bass
6. Lead
7. Chord
8. Texture

Every user receives the same pack.

Projects created during that week continue referencing the pack they were created with, even after newer packs are released.

Future versions may allow users to revisit previous packs through an archive, but this is not required for the MVP.

---

# Creativity Through Limitation

The product is built around a simple principle:

> Great ideas often come from limitations rather than unlimited choice.

Instead of asking:

> Which kick drum should I use?

the app encourages users to ask:

> What can I create using only these eight sounds?

The product should actively reduce option paralysis.

---

# User Experience Principles

The entire application should feel like a dedicated musical instrument.

The ideal workflow is:

1. Open the app.
2. Select a track.
3. Program a rhythm or melody.
4. Adjust the sound.
5. Play.
6. Jam.
7. Export.

There should be as little friction as possible between opening the app and hearing music.

---

# Hardware Inspiration

The workflow is inspired by compact hardware grooveboxes such as the Roland T-8.

However, the product must establish its own visual identity and interaction style.

The interface should feel:

- Modern
- Premium
- Minimal
- Scandinavian-inspired
- High quality
- Clean
- Confident

It must not imitate Roland branding or industrial design.

---

# Interface Philosophy

Everything important should be available from a single screen.

Avoid:

- Deep menus
- Multiple editing pages
- Complex routing
- Large dialog windows
- Hidden features
- Tiny controls

Every commonly used action should require no more than one or two interactions.

---

# Two-Handed Operation

The interface has been designed primarily for iPhone in landscape orientation.

It should be comfortable to operate with both hands.

The Shift button is positioned so it can be held with the right thumb while the left hand performs secondary actions such as muting tracks.

This hardware-like interaction model should be preserved throughout development.

---

# Audio Philosophy

The supplied samples should be transformed rather than replaced.

Users are encouraged to shape sounds using:

- Pitch
- Sample start
- Sample end
- Filter
- Resonance
- Effects

The app should encourage exploration of the supplied sounds instead of adding more sounds.

---

# Simplicity Before Features

Whenever there is a choice between:

- Adding another feature

or

- Improving the existing workflow

always choose the workflow.

Every new feature should answer the question:

> Does this make creating music more enjoyable?

If the answer is no, it should probably not be included.

---

# Technical Philosophy

The codebase should prioritise:

- Readability
- Simplicity
- Modularity
- Maintainability
- Performance

Avoid unnecessary abstractions or premature optimisation.

The application should remain understandable by a single developer.

---

# Community Vision (Future)

The long-term vision includes a shared creative community.

Potential future features include:

- Weekly challenges
- Track uploads
- Community listening
- Favourite tracks
- Featured creators
- Weekly highlights
- AI-generated or AI-curated sample packs

These features are **not part of the MVP**.

The MVP focuses entirely on creating an enjoyable music-making experience.

---

# AI Vision (Future)

Future versions may use AI to generate or curate weekly sample packs automatically.

The AI should produce packs that are:

- Cohesive
- Inspiring
- High quality
- Musically useful

The user should simply receive a new weekly pack without needing to understand how it was created.

The AI should support creativity rather than becoming the focus of the product.

---

# What Weekly Groovebox Is

Weekly Groovebox is:

- A groovebox
- A musical instrument
- A creative challenge
- A focused sampler
- A portable sketchpad
- A fun way to make music

---

# What Weekly Groovebox Is Not

Weekly Groovebox is not:

- A DAW
- A workstation
- A professional recording environment
- A plugin host
- A synthesiser editor
- A sample manager
- A general-purpose audio production suite

---

# MVP Scope

The first release should answer one question:

**Is making music with only one shared weekly sample pack genuinely fun?**

Everything else can be added later.

Success should be measured by how quickly users can begin creating music and whether they want to return each week for the next sound pack.

---

# Product North Star

Whenever an implementation decision is unclear, optimise for this experience:

> **A musician opens Weekly Groovebox, immediately understands how it works, starts making music within seconds, and discovers that having fewer choices actually makes the creative process more enjoyable.**