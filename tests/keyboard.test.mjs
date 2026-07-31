import test from "node:test";
import assert from "node:assert/strict";
import { shouldToggleTransportFromKeydown } from "../web/keyboard.mjs";

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
