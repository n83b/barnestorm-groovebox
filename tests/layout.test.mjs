import test from "node:test";
import assert from "node:assert/strict";
import {
  BASE_ASPECT_RATIO,
  calculateRenderedStage,
  calculateStageScale
} from "../web/layout.mjs";

test("uses the entire viewport at the 1024 by 576 reference size", () => {
  assert.equal(calculateStageScale(1024, 576), 1);
});

test("letterboxes wide iPhone viewports without changing the aspect ratio", () => {
  const stage = calculateRenderedStage(932, 430, 20, 16);

  assert.equal(stage.height, 414);
  assert.ok(Math.abs(stage.width / stage.height - BASE_ASPECT_RATIO) < Number.EPSILON * 2);
  assert.ok(stage.width < 912);
});

test("pillarboxes tall landscape viewports without changing the aspect ratio", () => {
  const stage = calculateRenderedStage(844, 390, 20, 16);

  assert.equal(stage.height, 374);
  assert.ok(Math.abs(stage.width / stage.height - BASE_ASPECT_RATIO) < Number.EPSILON * 2);
});
