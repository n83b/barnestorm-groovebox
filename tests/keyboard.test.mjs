import test from "node:test";
import assert from "node:assert/strict";
import {
  getShiftActionModifier,
  getShiftModifierState,
  getTouchShiftReleaseAction,
  isDoubleTap,
  isMomentaryTouchShift,
  shouldToggleTransportFromKeydown,
  toggleShiftModifier
} from "../web/keyboard.mjs";

const pageTarget = { closest: () => null };
const interactiveTarget = { closest: () => ({}) };
const knobTarget = {
  closest: () => ({}),
  matches: (selector) => selector === 'input.knob-input[type="range"]'
};
const playButtonTarget = {
  closest: () => ({}),
  matches: (selector) => selector === "#playButton"
};

test("uses an unmodified Space keydown to toggle transport", () => {
  assert.equal(
    shouldToggleTransportFromKeydown({
      code: "Space",
      key: " ",
      target: pageTarget
    }),
    true
  );
});

test("ignores repeat, modified and non-Space keydowns", () => {
  assert.equal(
    shouldToggleTransportFromKeydown({
      code: "Space",
      key: " ",
      repeat: true,
      target: pageTarget
    }),
    false
  );
  assert.equal(
    shouldToggleTransportFromKeydown({
      code: "Space",
      key: " ",
      metaKey: true,
      target: pageTarget
    }),
    false
  );
  assert.equal(
    shouldToggleTransportFromKeydown({
      code: "Enter",
      key: "Enter",
      target: pageTarget
    }),
    false
  );
});

test("leaves Space available to the focused interactive control", () => {
  assert.equal(
    shouldToggleTransportFromKeydown({
      code: "Space",
      key: " ",
      target: interactiveTarget
    }),
    false
  );
});

test("uses Space for transport when a knob range input retains focus", () => {
  assert.equal(
    shouldToggleTransportFromKeydown({
      code: "Space",
      key: " ",
      target: knobTarget
    }),
    true
  );
});

test("uses Space for transport when the Play button retains focus", () => {
  assert.equal(
    shouldToggleTransportFromKeydown({
      code: "Space",
      key: " ",
      target: playButtonTarget
    }),
    true
  );
});

test("toggles the desktop on-screen Shift modifier with each click", () => {
  let buttonToggled = false;

  buttonToggled = toggleShiftModifier(buttonToggled);
  assert.equal(getShiftModifierState({ buttonToggled }), true);

  buttonToggled = toggleShiftModifier(buttonToggled);
  assert.equal(getShiftModifierState({ buttonToggled }), false);
});

test("double-taps to lock touch Shift and single-taps to unlock", () => {
  const firstTap = { time: 1000, x: 120, y: 80, pointerType: "touch" };
  const secondTap = { time: 1260, x: 124, y: 82, pointerType: "touch" };

  assert.equal(getTouchShiftReleaseAction(null, firstTap), "tap");
  assert.equal(getTouchShiftReleaseAction(firstTap, secondTap), "toggle");
  assert.equal(
    getTouchShiftReleaseAction(null, firstTap, { locked: true }),
    "toggle"
  );
  assert.equal(
    getTouchShiftReleaseAction(firstTap, secondTap, {
      locked: true,
      momentary: true
    }),
    "momentary"
  );
});

test("keeps the physical Shift key momentary alongside the button toggle", () => {
  assert.equal(getShiftModifierState({ keyboardHeld: true }), true);
  assert.equal(
    getShiftModifierState({ buttonToggled: true, keyboardHeld: false }),
    true
  );
});

test("keeps Shift active while its touch button is held", () => {
  assert.equal(getShiftModifierState({ touchHeld: true }), true);
  assert.equal(
    getShiftModifierState({ buttonToggled: true, touchHeld: false }),
    true
  );
});

test("resolves every touch action on release using Shift from touch-down", () => {
  assert.equal(
    getShiftActionModifier({
      pointerType: "touch",
      shiftAtPointerDown: false,
      currentShift: false
    }),
    false
  );
  assert.equal(
    getShiftActionModifier({
      pointerType: "touch",
      shiftAtPointerDown: true,
      currentShift: false
    }),
    true
  );
  assert.equal(
    getShiftActionModifier({ currentShift: true }),
    true
  );
});

test("distinguishes a touch hold from a quick toggle tap", () => {
  assert.equal(
    isMomentaryTouchShift({ pointerType: "touch", duration: 260 }),
    true
  );
  assert.equal(
    isMomentaryTouchShift({ pointerType: "touch", duration: 120 }),
    false
  );
  assert.equal(
    isMomentaryTouchShift({
      pointerType: "touch",
      duration: 120,
      usedWhileHeld: true
    }),
    true
  );
  assert.equal(
    isMomentaryTouchShift({ pointerType: "mouse", duration: 400 }),
    false
  );
});

test("recognises a touch double tap without relying on a dblclick event", () => {
  const firstTap = { time: 1000, x: 120, y: 80, pointerType: "touch" };

  assert.equal(
    isDoubleTap(firstTap, { time: 1280, x: 132, y: 86, pointerType: "touch" }),
    true
  );
  assert.equal(
    isDoubleTap(firstTap, { time: 1400, x: 132, y: 86, pointerType: "touch" }),
    false
  );
  assert.equal(
    isDoubleTap(firstTap, { time: 1280, x: 170, y: 80, pointerType: "touch" }),
    false
  );
});

test("does not combine touch and mouse presses into one double tap", () => {
  assert.equal(
    isDoubleTap(
      { time: 1000, x: 120, y: 80, pointerType: "touch" },
      { time: 1200, x: 120, y: 80, pointerType: "mouse" }
    ),
    false
  );
});
