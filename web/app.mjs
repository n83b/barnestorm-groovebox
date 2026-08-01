import {
  BANKS,
  PARAMETER_DEFINITIONS,
  PATTERN_NAMES,
  PATTERNS_PER_BANK,
  TRACKS,
  clearPatternSequence,
  clearTrackAutomation,
  clearTrackSequence,
  commitQueuedPattern,
  createInitialState,
  formatNote,
  getAutomatedTrackParameters,
  getPatternTrackParameters,
  getSelectedPatternTrack,
  getTrackPlayhead,
  hasTrackAutomation,
  restoreState,
  selectBank,
  selectPattern,
  setParameter,
  setStepAutomation,
  setTrackLength,
  toggleStep
} from "./state.mjs?v=dev";
import { AudioEngine } from "./audio-engine.mjs?v=dev";
import {
  IndexedDbPackRepository,
  PackDelivery,
  getDaysRemaining
} from "./pack-delivery.mjs?v=dev";
import {
  getShiftModifierState,
  shouldToggleTransportFromKeydown,
  toggleShiftModifier
} from "./keyboard.mjs?v=dev";
import { BASE_HEIGHT, BASE_WIDTH, calculateStageScale } from "./layout.mjs?v=dev";

const LEGACY_STORAGE_KEY = "weekly-groovebox-project-v1";
const ACTIVE_PACK_STORAGE_KEY = "weekly-groovebox-active-pack-v1";
const PROJECT_STORAGE_PREFIX = "weekly-groovebox-project-v2:";
const PACK_POINTER_URL = "./assets/packs/current.json";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const elements = {
  availabilityDot: document.querySelector("#availabilityDot"),
  daysLeft: document.querySelector("#daysLeft"),
  editBubble: document.querySelector("#editBubble"),
  globalControls: document.querySelector("#globalControls"),
  packCard: document.querySelector("#packCard"),
  packName: document.querySelector("#packName"),
  parameterList: document.querySelector("#parameterList"),
  patternLengthLabel: document.querySelector("#patternLengthLabel"),
  patternList: document.querySelector("#patternList"),
  patternPosition: document.querySelector("#patternPosition"),
  playButton: document.querySelector("#playButton"),
  saveStatus: document.querySelector("#saveStatus"),
  selectedTrackName: document.querySelector("#selectedTrackName"),
  shiftButton: document.querySelector("#shiftButton"),
  stepGrid: document.querySelector("#stepGrid"),
  stopButton: document.querySelector("#stopButton"),
  trackList: document.querySelector("#trackList"),
  weekNumber: document.querySelector("#weekNumber"),
  groovebox: document.querySelector(".groovebox")
};

let state = loadState();
let isPlaying = false;
let isStartingPlayback = false;
let transportTick = 0;
let shiftHeld = false;
let shiftToggled = false;
let stopHeld = false;
let stopLocked = false;
let saveStatusTimer = null;
let editSession = null;
let stageResizeFrame = null;
let activePackOffline = false;
const audioEngine = new AudioEngine({ onStatusChange: handleAudioEngineStatus });
const packDelivery = new PackDelivery({
  pointerUrl: PACK_POINTER_URL,
  repository: new IndexedDbPackRepository(),
  onStatusChange: updatePackStatus
});

updateStageScale();
renderDateMetadata();
renderGlobalControls();
renderAll();
bindTransport();
bindShift();
bindStageScaling();
initializeAudio();

function bindStageScaling() {
  const scheduleUpdate = () => {
    window.cancelAnimationFrame(stageResizeFrame);
    stageResizeFrame = window.requestAnimationFrame(updateStageScale);
  };

  window.addEventListener("resize", scheduleUpdate, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleUpdate, { passive: true });
}

function updateStageScale() {
  const bodyStyle = window.getComputedStyle(document.body);
  const horizontalInset = parseFloat(bodyStyle.paddingLeft) + parseFloat(bodyStyle.paddingRight);
  const verticalInset = parseFloat(bodyStyle.paddingTop) + parseFloat(bodyStyle.paddingBottom);
  const viewportWidth = window.visualViewport?.width ?? document.documentElement.clientWidth;
  const viewportHeight = window.visualViewport?.height ?? document.documentElement.clientHeight;
  const scale = calculateStageScale(viewportWidth, viewportHeight, horizontalInset, verticalInset);

  elements.groovebox.style.setProperty("--stage-scale", String(scale));
  elements.groovebox.setAttribute("data-layout-size", `${BASE_WIDTH}x${BASE_HEIGHT}`);
}

function loadState() {
  try {
    const activePackId = localStorage.getItem(ACTIVE_PACK_STORAGE_KEY);
    const savedProject = activePackId
      ? localStorage.getItem(getProjectStorageKey(activePackId))
      : localStorage.getItem(LEGACY_STORAGE_KEY);
    return restoreState(JSON.parse(savedProject));
  } catch {
    return createInitialState();
  }
}

function loadProjectForPack(packId) {
  try {
    const savedProject = localStorage.getItem(getProjectStorageKey(packId));
    return savedProject ? restoreState(JSON.parse(savedProject)) : null;
  } catch {
    return null;
  }
}

function getProjectStorageKey(packId) {
  return `${PROJECT_STORAGE_PREFIX}${packId}`;
}

function persistState(showStatus = true) {
  try {
    if (state.packId) {
      localStorage.setItem(ACTIVE_PACK_STORAGE_KEY, state.packId);
      localStorage.setItem(getProjectStorageKey(state.packId), JSON.stringify(state));
    } else {
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(state));
    }
    if (showStatus) {
      elements.saveStatus.classList.add("is-visible");
      window.clearTimeout(saveStatusTimer);
      saveStatusTimer = window.setTimeout(() => elements.saveStatus.classList.remove("is-visible"), 850);
    }
  } catch {
    // The instrument stays usable if private browsing blocks storage.
  }
}

async function initializeAudio() {
  syncProjectAudioSettings();

  try {
    const result = await packDelivery.loadCurrent({ fallbackPackId: state.packId });
    activePackOffline = result.offline;
    activateProjectForPack(result.delivery.manifest.id);
    await audioEngine.loadPack(result.delivery);
  } catch {
    // Delivery and decoding errors are exposed by the pack card.
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (isPlaying) audioEngine.resume().catch(() => {});
    packDelivery.loadCurrent({ fallbackPackId: state.packId, quiet: true }).catch(() => {});
  });
  window.addEventListener("pagehide", () => audioEngine.stop());
}

function syncProjectAudioSettings() {
  state.trackParameters.forEach((_, trackIndex) => {
    audioEngine.setTrackParameters(
      trackIndex,
      getPatternTrackParameters(state, state.selectedPattern, trackIndex)
    );
    audioEngine.setMuted(trackIndex, state.muted[trackIndex]);
  });
  audioEngine.setCompressor(state.compressor);
}

function activateProjectForPack(packId) {
  if (!state.packId) {
    state.packId = packId;
  } else if (state.packId !== packId) {
    persistState(false);
    state = loadProjectForPack(packId) ?? createInitialState(packId);
  }

  persistState(false);
  renderGlobalControls();
  renderAll();
  syncProjectAudioSettings();
}

function handleAudioEngineStatus(status, detail) {
  if (status === "ready" && activePackOffline) {
    updatePackStatus("offline", { manifest: detail });
  } else {
    updatePackStatus(status, detail);
  }
}

function updatePackStatus(status, detail) {
  const isLoading = ["checking", "downloading", "downloaded", "cached", "loading"].includes(status);
  const pack = detail?.manifest ?? detail;

  elements.packCard.classList.toggle("is-loading", isLoading);
  elements.packCard.classList.toggle("is-error", status === "error");
  elements.packCard.classList.toggle("is-offline", status === "offline");
  elements.availabilityDot.classList.toggle("is-loading", isLoading);
  elements.availabilityDot.classList.toggle("is-error", status === "error");
  elements.availabilityDot.classList.toggle("is-offline", status === "offline");

  if (["ready", "offline"].includes(status) && pack?.tracks?.length === 8) {
    elements.weekNumber.textContent = `Week ${pack.week}`;
    elements.packName.textContent = pack.name;
    renderPackCountdown(pack, status === "offline");
    elements.packCard.setAttribute(
      "aria-label",
      `${status === "offline" ? "Saved" : "This week's"} sample pack, ${pack.name}, eight samples loaded`
    );
  } else if (status === "downloading") {
    elements.daysLeft.textContent = `Downloading ${detail?.completed ?? 0}/${detail?.total ?? 8}`;
    elements.packCard.setAttribute("aria-label", `Weekly pack downloading, ${detail?.completed ?? 0} of ${detail?.total ?? 8} samples`);
  } else if (isLoading) {
    elements.packCard.setAttribute("aria-label", "This week's sample pack is loading");
  } else if (status === "error") {
    elements.daysLeft.textContent = "Connection required";
    elements.packCard.setAttribute(
      "aria-label",
      `This week's sample pack could not load: ${detail?.message ?? "unknown error"}`
    );
  }
}

function renderAll() {
  renderTracks();
  renderSteps();
  renderPatterns();
  renderParameters();
  renderTransport();
}

function renderDateMetadata() {
  const today = new Date();
  const week = getIsoWeek(today);
  const day = today.getDay();
  const daysRemaining = day === 0 ? 0 : 7 - day;

  elements.weekNumber.textContent = `Week ${week}`;
  elements.daysLeft.textContent = daysRemaining === 1 ? "1 day left" : `${daysRemaining} days left`;
}

function renderPackCountdown(pack, offline) {
  const daysRemaining = getDaysRemaining(pack.expiresAt);
  if (offline && daysRemaining === 0) {
    elements.daysLeft.textContent = "Saved offline";
  } else if (daysRemaining == null) {
    elements.daysLeft.textContent = offline ? "Saved offline" : "Downloaded";
  } else if (daysRemaining === 0) {
    elements.daysLeft.textContent = "Changes today";
  } else {
    elements.daysLeft.textContent = daysRemaining === 1 ? "1 day left" : `${daysRemaining} days left`;
  }
}

function renderTracks() {
  elements.trackList.replaceChildren(
    ...TRACKS.map((track, trackIndex) => {
      const button = document.createElement("button");
      const isSelected = state.selectedTrack === trackIndex;
      const isMuted = state.muted[trackIndex];

      button.type = "button";
      button.className = "track-button";
      button.style.setProperty("--track-color", track.color);
      button.classList.toggle("is-selected", isSelected);
      button.classList.toggle("is-muted", isMuted);
      button.setAttribute("aria-pressed", String(isSelected));
      button.setAttribute("aria-label", `${trackIndex + 1} ${track.name}${isMuted ? ", muted" : ""}`);

      const number = document.createElement("span");
      number.className = "track-number";
      number.textContent = String(trackIndex + 1);

      const waveform = createWaveform(trackIndex);
      const name = document.createElement("span");
      name.className = "track-name";
      name.textContent = track.name;

      const indicator = document.createElement("span");
      indicator.className = "track-indicator";

      button.append(number, waveform, name, indicator);

      if (isMuted) {
        const muteSymbol = document.createElement("span");
        muteSymbol.className = "mute-symbol";
        muteSymbol.setAttribute("aria-hidden", "true");
        muteSymbol.textContent = "⌁";
        button.append(muteSymbol);
      }

      button.addEventListener("click", () => {
        if (stopLocked) {
          clearTrackSequence(state, state.selectedPattern, trackIndex);
        } else if (shiftHeld) {
          state.muted[trackIndex] = !state.muted[trackIndex];
          audioEngine.setMuted(trackIndex, state.muted[trackIndex]);
        } else {
          state.selectedTrack = trackIndex;
        }

        persistState();
        renderAll();
      });

      return button;
    })
  );
}

function createWaveform(trackIndex) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const center = 30;
  const width = 140;
  const segments = 38;
  let data = "";

  for (let index = 0; index < segments; index += 1) {
    const x = (index / (segments - 1)) * width;
    const envelope = Math.pow(1 - index / segments, 1.45);
    const texture = 0.34 + Math.abs(Math.sin(index * (1.71 + trackIndex * 0.08))) * 0.66;
    const amplitude = Math.max(1.2, envelope * texture * (24 - (trackIndex % 4) * 1.7));
    data += `M ${x.toFixed(2)} ${(center - amplitude).toFixed(2)} V ${(center + amplitude).toFixed(2)} `;
  }

  svg.classList.add("track-waveform");
  svg.setAttribute("viewBox", "0 0 140 60");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  path.setAttribute("d", data);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.15");
  path.setAttribute("stroke-linecap", "round");
  svg.append(path);
  return svg;
}

function renderSteps() {
  if (editSession) return;

  const patternTrack = getSelectedPatternTrack(state);
  const visiblePlayhead = getTrackPlayhead(transportTick, patternTrack.length);
  elements.stepGrid.style.setProperty("--selected-track-color", TRACKS[state.selectedTrack].color);

  elements.stepGrid.replaceChildren(
    ...patternTrack.steps.map((step, stepIndex) => {
      const wrap = document.createElement("div");
      const number = document.createElement("span");
      const button = document.createElement("button");
      const isDisabled = stepIndex >= patternTrack.length;
      const automationKeys = Object.keys(step.automation ?? {});

      wrap.className = "step-wrap";
      wrap.classList.toggle("is-playhead", isPlaying && visiblePlayhead === stepIndex);

      number.className = "step-number";
      number.textContent = String(stepIndex + 1);

      button.type = "button";
      button.className = "step-button";
      button.classList.toggle("is-active", step.active && !isDisabled);
      button.classList.toggle("is-disabled", isDisabled);
      button.classList.toggle("is-last-step", stepIndex === patternTrack.length - 1);
      button.style.setProperty("--velocity-fill", `${Math.max(13, (step.velocity / 127) * 100)}%`);
      button.setAttribute("aria-pressed", String(step.active));
      button.setAttribute("aria-disabled", String(isDisabled));
      button.setAttribute(
        "aria-label",
        `Step ${stepIndex + 1}, ${step.active ? "active" : "inactive"}, velocity ${step.velocity}${
          TRACKS[state.selectedTrack].kind === "chromatic" ? `, note ${formatNote(step.note)}` : ""
        }${automationKeys.length > 0 ? `, ${automationKeys.length} automated parameters` : ""}${
          isDisabled ? ", beyond last step" : ""
        }`
      );

      if (TRACKS[state.selectedTrack].kind === "chromatic" && step.active && !isDisabled) {
        const noteLabel = document.createElement("span");
        noteLabel.className = "step-note-label";
        noteLabel.textContent = formatNote(step.note);
        noteLabel.setAttribute("aria-hidden", "true");
        button.append(noteLabel);
      }

      bindStepGesture(button, stepIndex);
      wrap.append(number, button);
      return wrap;
    })
  );
}

function bindStepGesture(button, stepIndex) {
  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;

    const patternTrack = getSelectedPatternTrack(state);
    const step = patternTrack.steps[stepIndex];
    const session = {
      button,
      stepIndex,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originalNote: step.note,
      originalVelocity: step.velocity,
      activeAtStart: step.active,
      editing: false,
      timer: null
    };

    editSession = session;
    button.setPointerCapture(event.pointerId);

    if (step.active && stepIndex < patternTrack.length && !shiftHeld) {
      audioEngine.resume().catch(() => {});
      session.timer = window.setTimeout(() => beginStepEdit(session), 250);
    }
  });

  button.addEventListener("pointermove", (event) => {
    if (!editSession || editSession.pointerId !== event.pointerId || !editSession.editing) return;

    const patternTrack = getSelectedPatternTrack(state);
    const step = patternTrack.steps[stepIndex];
    const deltaX = event.clientX - editSession.startX;
    const deltaY = event.clientY - editSession.startY;

    step.velocity = clamp(Math.round(editSession.originalVelocity - deltaY * 1.15), 1, 127);
    if (TRACKS[state.selectedTrack].kind === "chromatic") {
      step.note = clamp(Math.round(editSession.originalNote + deltaX / 11), 36, 72);
      const noteLabel = button.querySelector(".step-note-label");
      if (noteLabel) noteLabel.textContent = formatNote(step.note);
    }

    button.style.setProperty("--velocity-fill", `${Math.max(13, (step.velocity / 127) * 100)}%`);
    updateEditBubble(button, step);
    previewEditedStep(step);
  });

  const finish = (event) => {
    if (!editSession || editSession.pointerId !== event.pointerId) return;

    window.clearTimeout(editSession.timer);
    const session = editSession;
    editSession = null;
    hideEditBubble();

    if (session.editing) {
      persistState();
      renderSteps();
      return;
    }

    const travel = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);
    if (travel > 14) {
      renderSteps();
      return;
    }

    if (shiftHeld) {
      setTrackLength(state, stepIndex);
    } else {
      toggleStep(state, stepIndex);
    }

    persistState();
    renderSteps();
    renderPatterns();
  };

  button.addEventListener("pointerup", finish);
  button.addEventListener("pointercancel", (event) => {
    if (!editSession || editSession.pointerId !== event.pointerId) return;
    window.clearTimeout(editSession.timer);
    editSession = null;
    hideEditBubble();
    renderSteps();
  });
}

function beginStepEdit(session) {
  if (editSession !== session) return;
  session.editing = true;
  session.button.classList.add("is-editing");
  const step = getSelectedPatternTrack(state).steps[session.stepIndex];
  session.lastPreviewAt = 0;
  session.lastPreviewNote = null;
  session.lastPreviewVelocity = null;
  updateEditBubble(session.button, step);
  previewEditedStep(step, true);
}

function previewEditedStep(step, force = false) {
  if (!editSession?.editing) return;

  const now = performance.now();
  const noteChanged = editSession.lastPreviewNote !== step.note;
  const velocityChanged = editSession.lastPreviewVelocity !== step.velocity;
  if (!force && (!noteChanged && !velocityChanged || now - editSession.lastPreviewAt < 35)) {
    return;
  }

  editSession.lastPreviewAt = now;
  editSession.lastPreviewNote = step.note;
  editSession.lastPreviewVelocity = step.velocity;
  audioEngine.preview(state.selectedTrack, step.note, step.velocity).catch(() => {});
}

function updateEditBubble(button, step) {
  const rect = button.getBoundingClientRect();
  const note = TRACKS[state.selectedTrack].kind === "chromatic" ? `${formatNote(step.note)} · ` : "";

  elements.editBubble.textContent = `${note}Vel ${step.velocity}`;
  elements.editBubble.style.left = `${rect.left + rect.width / 2}px`;
  elements.editBubble.style.top = `${rect.top}px`;
  elements.editBubble.classList.add("is-visible");
}

function hideEditBubble() {
  elements.editBubble.classList.remove("is-visible");
}

function renderPatterns() {
  const bank = BANKS[state.selectedBank];
  const bankStart = state.selectedBank * PATTERNS_PER_BANK;
  const visiblePatterns = PATTERN_NAMES.slice(bankStart, bankStart + PATTERNS_PER_BANK);

  elements.patternList.parentElement.style.setProperty("--bank-color", bank.color);

  const buttons = visiblePatterns.map((patternName, slotIndex) => {
    const patternIndex = bankStart + slotIndex;
    const button = document.createElement("button");
    const isCurrent = state.selectedPattern === patternIndex;
    const isQueued = state.queuedPattern === patternIndex;

    button.type = "button";
    button.className = "pattern-button";
    button.classList.toggle("is-current", isCurrent);
    button.classList.toggle("is-queued", isQueued);
    button.textContent = patternName;
    button.setAttribute("aria-pressed", String(isCurrent));
    button.setAttribute("aria-label", `Pattern ${patternName}${isQueued ? ", queued" : ""}`);
    button.addEventListener("click", () => {
      if (stopLocked) {
        clearPatternSequence(state, patternIndex);
        persistState();
        renderPatterns();
        if (patternIndex === state.selectedPattern) {
          renderSteps();
          renderParameters();
        }
        return;
      }

      selectPattern(state, patternIndex, isPlaying);
      persistState();
      renderPatterns();
      if (!isPlaying) {
        renderSteps();
        renderParameters();
        syncPatternAudioParameters();
      }
    });
    return button;
  });

  const overflow = document.createElement("button");
  overflow.type = "button";
  overflow.className = "pattern-button overflow";
  const nextBankIndex = (state.selectedBank + 1) % BANKS.length;
  overflow.setAttribute(
    "aria-label",
    `Pattern bank ${bank.name}, switch to bank ${BANKS[nextBankIndex].name}`
  );
  overflow.replaceChildren(
    ...BANKS.map((bankOption, bankIndex) => {
      const dot = document.createElement("span");
      dot.className = "bank-dot";
      dot.classList.toggle("is-current", bankIndex === state.selectedBank);
      dot.style.setProperty("--bank-dot-color", bankOption.color);
      dot.setAttribute("aria-hidden", "true");
      return dot;
    })
  );
  overflow.addEventListener("click", () => {
    selectBank(state, nextBankIndex, isPlaying);
    persistState();
    renderPatterns();
    if (!isPlaying) {
      renderSteps();
      renderParameters();
      syncPatternAudioParameters();
    }
  });

  elements.patternList.replaceChildren(...buttons, overflow);
  elements.patternPosition.replaceChildren(
    ...Array.from({ length: PATTERNS_PER_BANK }, (_, slotIndex) => {
      const patternIndex = bankStart + slotIndex;
      const marker = document.createElement("span");
      marker.classList.toggle("is-current", state.selectedPattern === patternIndex);
      return marker;
    })
  );

  elements.patternLengthLabel.textContent = String(getSelectedPatternTrack(state).length);
  updateParameterAutomationIndicators();
}

function renderGlobalControls() {
  elements.globalControls.replaceChildren(
    createKnob({
      label: "Tempo",
      min: 40,
      max: 240,
      step: 0.5,
      defaultValue: 128,
      value: () => state.tempo,
      format: (value) => value.toFixed(1),
      onChange: (value) => {
        state.tempo = value;
        persistState();
        return state.tempo;
      }
    }),
    createKnob({
      label: "Swing",
      min: 0,
      max: 60,
      step: 1,
      defaultValue: 0,
      value: () => state.swing,
      format: (value) => `${value}%`,
      onChange: (value) => {
        state.swing = value;
        persistState();
        return state.swing;
      }
    }),
    createKnob({
      label: "Comp",
      min: 0,
      max: 100,
      step: 1,
      defaultValue: 0,
      value: () => state.compressor,
      format: (value) => `${value}%`,
      accent: "fx",
      onChange: (value) => {
        state.compressor = value;
        audioEngine.setCompressor(value);
        persistState();
        return state.compressor;
      }
    })
  );
}

function renderParameters() {
  const track = TRACKS[state.selectedTrack];
  const patternParameters = getSelectedPatternTrack(state).parameters;

  elements.selectedTrackName.textContent = `${state.selectedTrack + 1} · ${track.name}`;
  elements.selectedTrackName.parentElement.style.setProperty("--selected-color", track.color);

  elements.parameterList.replaceChildren(
    ...PARAMETER_DEFINITIONS.map((definition) =>
      createKnob({
        ...definition,
        automationKey: definition.key,
        value: () => {
          if (!shiftHeld) return patternParameters[definition.key];
          const patternTrack = getSelectedPatternTrack(state);
          const stepIndex = getTrackPlayhead(transportTick, patternTrack.length);
          return getAutomatedTrackParameters(
            state,
            state.selectedPattern,
            state.selectedTrack,
            stepIndex
          )[definition.key];
        },
        onChange: (value) => {
          if (stopHeld) {
            clearTrackAutomation(state, definition.key);
            audioEngine.setTrackParameters(state.selectedTrack, patternParameters);
            persistState();
            updateParameterAutomationIndicators();
            renderSteps();
            return patternParameters[definition.key];
          }

          if (shiftHeld) {
            const patternTrack = getSelectedPatternTrack(state);
            const stepIndex = getTrackPlayhead(transportTick, patternTrack.length);
            setStepAutomation(state, stepIndex, definition.key, value);
            const automatedParameters = getAutomatedTrackParameters(
              state,
              state.selectedPattern,
              state.selectedTrack,
              stepIndex
            );
            audioEngine.setTrackParameters(state.selectedTrack, automatedParameters);
            persistState();
            updateParameterAutomationIndicators();
            renderSteps();
            return automatedParameters[definition.key];
          }

          setParameter(state, definition.key, value);
          audioEngine.setTrackParameters(state.selectedTrack, patternParameters);
          persistState();
          return patternParameters[definition.key];
        }
      })
    )
  );
  updateParameterAutomationIndicators();
}

function syncPatternAudioParameters() {
  state.trackParameters.forEach((_, trackIndex) => {
    audioEngine.setTrackParameters(
      trackIndex,
      getPatternTrackParameters(state, state.selectedPattern, trackIndex)
    );
  });
}

function updateParameterAutomationIndicators() {
  elements.parameterList
    .querySelectorAll("[data-automation-key]")
    .forEach((control) => {
      const key = control.dataset.automationKey;
      const isAutomated = hasTrackAutomation(state, key);
      const input = control.querySelector(".knob-input");

      control.classList.toggle("has-automation", isAutomated);
      if (isAutomated) {
        input?.setAttribute("aria-description", `${key} has recorded automation`);
      } else {
        input?.removeAttribute("aria-description");
      }
    });
}

function createKnob({
  label,
  min,
  max,
  step,
  defaultValue,
  value,
  format,
  onChange,
  sublabel,
  accent,
  bipolar = false,
  automationKey = null
}) {
  const control = document.createElement("label");
  const labelElement = document.createElement("span");
  const knob = document.createElement("span");
  const indicator = document.createElement("span");
  const baseDot = document.createElement("span");
  const input = document.createElement("input");
  const valueElement = document.createElement("span");
  const ticks = ["start", "center", "end"].map((position) => {
    const tick = document.createElement("span");
    tick.className = `knob-tick knob-tick-${position}`;
    tick.setAttribute("aria-hidden", "true");
    return tick;
  });

  control.className = "knob-control";
  if (automationKey) control.dataset.automationKey = automationKey;
  if (accent === "fx") control.style.setProperty("--accent", "var(--purple)");
  labelElement.className = "knob-label";
  labelElement.textContent = label;
  knob.className = "knob";
  knob.classList.toggle("is-bipolar", bipolar);
  indicator.className = "knob-indicator";
  baseDot.className = "knob-base-dot";
  baseDot.setAttribute("aria-hidden", "true");
  input.className = "knob-input";
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.setAttribute("aria-label", label);
  valueElement.className = "knob-value";

  const applyVisualValue = (nextValue) => {
    const normalized = (nextValue - min) / (max - min);
    const angle = normalized * 270;
    const centerAngle = clamp(((0 - min) / (max - min)) * 270, 0, 270);
    const fillStart = bipolar ? Math.min(angle, centerAngle) : 0;
    const fillEnd = bipolar ? Math.max(angle, centerAngle) : angle;

    knob.style.setProperty("--angle", `${angle}deg`);
    knob.style.setProperty("--fill-start", `${fillStart}deg`);
    knob.style.setProperty("--fill-end", `${fillEnd}deg`);
    input.value = String(nextValue);
    input.setAttribute("aria-valuetext", format(nextValue));
    valueElement.textContent = sublabel ?? format(nextValue);
    valueElement.title = format(nextValue);
  };

  applyVisualValue(value());
  knob.append(...ticks, baseDot, indicator, input);
  control.append(labelElement, knob, valueElement);

  let drag = null;

  knob.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    input.focus();
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startValue: value()
    };
    knob.setPointerCapture(event.pointerId);
  });

  knob.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const sensitivity = event.shiftKey ? 520 : 150;
    const horizontalDistance = event.clientX - drag.startX;
    const verticalDistance = drag.startY - event.clientY;
    const dragDistance = Math.abs(horizontalDistance) > Math.abs(verticalDistance)
      ? horizontalDistance
      : verticalDistance;
    const rawValue = drag.startValue + (dragDistance / sensitivity) * (max - min);
    const roundedValue = Math.round(rawValue / step) * step;
    const nextValue = onChange(clamp(roundedValue, min, max));
    control.classList.toggle("is-automation-write", Boolean(automationKey && shiftHeld));
    applyVisualValue(nextValue);
  });

  const finishDrag = (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag = null;
    control.classList.remove("is-automation-write");
    input.blur();
  };

  knob.addEventListener("pointerup", finishDrag);
  knob.addEventListener("pointercancel", finishDrag);
  knob.addEventListener("dblclick", () => {
    applyVisualValue(onChange(defaultValue));
  });

  input.addEventListener("input", () => {
    control.classList.toggle("is-automation-write", Boolean(automationKey && shiftHeld));
    applyVisualValue(onChange(Number(input.value)));
  });

  return control;
}

function bindTransport() {
  let stopPointerHeld = false;
  let stopKeyboardHeld = false;

  const updateStop = () => {
    stopHeld = stopLocked || stopPointerHeld || stopKeyboardHeld;
    elements.stopButton.classList.toggle("is-held", stopHeld);
    elements.stopButton.classList.toggle("is-locked", stopLocked);
    elements.parameterList.classList.toggle("is-automation-clear-armed", stopHeld);
    elements.stopButton.setAttribute("aria-pressed", String(stopLocked));
    elements.stopButton.setAttribute(
      "aria-label",
      stopLocked
        ? "Clear lock active; select a sample or pattern to clear it, or press to unlock"
        : "Stop, hold to clear automation, double click to lock"
    );
  };

  elements.playButton.addEventListener("click", (event) => {
    void startPlayback();
    if (event.detail > 0) elements.playButton.blur();
  });
  elements.stopButton.addEventListener("click", () => {
    if (stopLocked) {
      stopLocked = false;
      updateStop();
    }
    stopPlayback();
  });
  elements.stopButton.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    elements.stopButton.setPointerCapture(event.pointerId);
    if (stopLocked) stopLocked = false;
    stopPointerHeld = true;
    updateStop();
    stopPlayback();
  });
  const releaseStopPointer = (event) => {
    if (
      elements.stopButton.hasPointerCapture?.(event.pointerId)
    ) {
      elements.stopButton.releasePointerCapture(event.pointerId);
    }
    stopPointerHeld = false;
    updateStop();
  };
  elements.stopButton.addEventListener("pointerup", releaseStopPointer);
  elements.stopButton.addEventListener("pointercancel", releaseStopPointer);
  elements.stopButton.addEventListener("dblclick", () => {
    stopLocked = true;
    updateStop();
  });
  elements.stopButton.addEventListener("keydown", (event) => {
    if ((event.key === " " || event.key === "Enter") && !event.repeat) {
      stopKeyboardHeld = true;
      updateStop();
      stopPlayback();
    }
  });
  elements.stopButton.addEventListener("keyup", (event) => {
    if (event.key === " " || event.key === "Enter") {
      stopKeyboardHeld = false;
      updateStop();
    }
  });
  elements.stopButton.addEventListener("blur", () => {
    stopPointerHeld = false;
    stopKeyboardHeld = false;
    updateStop();
  });
  window.addEventListener("keydown", (event) => {
    if (!shouldToggleTransportFromKeydown(event)) return;

    event.preventDefault();
    if (isPlaying) {
      stopPlayback();
    } else {
      void startPlayback();
    }
  });
  updateStop();
}

async function startPlayback() {
  if (isPlaying || isStartingPlayback) return;

  isStartingPlayback = true;
  elements.playButton.setAttribute("aria-busy", "true");

  try {
    await audioEngine.start({
      getState: () => state,
      onTick: handleAudioTick
    });
    transportTick = 0;
    isPlaying = true;
    renderTransport();
    renderSteps();
  } catch (error) {
    updatePackStatus("error", error);
  } finally {
    isStartingPlayback = false;
    elements.playButton.removeAttribute("aria-busy");
  }
}

function stopPlayback() {
  isPlaying = false;
  transportTick = 0;
  audioEngine.stop();
  syncPatternAudioParameters();
  renderTransport();
  renderSteps();
}

function handleAudioTick({ tick, patternIndex }) {
  transportTick = tick;

  const patternChanged = patternIndex !== state.selectedPattern;
  if (transportTick > 0 && transportTick % 16 === 0 && patternChanged) {
    commitQueuedPattern(state, patternIndex);
    persistState();
    renderPatterns();
    renderParameters();
  }

  if (transportTick % 4 === 0) pulseBeat();
  renderSteps();
}

function pulseBeat() {
  if (reducedMotion.matches) return;
  elements.playButton.classList.remove("is-beat");
  requestAnimationFrame(() => elements.playButton.classList.add("is-beat"));
}

function renderTransport() {
  elements.playButton.classList.toggle("is-playing", isPlaying);
  elements.playButton.setAttribute("aria-pressed", String(isPlaying));
  elements.playButton.setAttribute("aria-label", isPlaying ? "Playing" : "Play");
}

function bindShift() {
  let physicalKeyboardHeld = false;

  const updateShift = () => {
    const wasShiftHeld = shiftHeld;
    shiftHeld = getShiftModifierState({
      buttonToggled: shiftToggled,
      keyboardHeld: physicalKeyboardHeld
    });
    elements.shiftButton.classList.toggle("is-held", shiftHeld);
    elements.shiftButton.classList.toggle("is-locked", shiftToggled);
    elements.parameterList.classList.toggle("is-automation-armed", shiftHeld);
    elements.shiftButton.setAttribute("aria-pressed", String(shiftHeld));
    elements.shiftButton.setAttribute(
      "aria-label",
      shiftToggled ? "Shift active, press to turn off" : "Shift, press to turn on"
    );
    if (wasShiftHeld && !shiftHeld) {
      elements.parameterList
        .querySelectorAll(".is-automation-write")
        .forEach((control) => control.classList.remove("is-automation-write"));
      audioEngine.setTrackParameters(
        state.selectedTrack,
        getPatternTrackParameters(state)
      );
    }
  };

  elements.shiftButton.addEventListener("click", () => {
    shiftToggled = toggleShiftModifier(shiftToggled);
    updateShift();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Shift") {
      physicalKeyboardHeld = true;
      updateShift();
    }
  });
  window.addEventListener("keyup", (event) => {
    if (event.key === "Shift") {
      physicalKeyboardHeld = false;
      updateShift();
    }
  });
  window.addEventListener("blur", () => {
    physicalKeyboardHeld = false;
    updateShift();
  });

  updateShift();
}

function getIsoWeek(date) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  return Math.ceil(((utcDate - yearStart) / 86_400_000 + 1) / 7);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
