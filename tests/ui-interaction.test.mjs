import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const webDirectory = new URL("../web/", import.meta.url);

test("knob drags use horizontal movement only", async () => {
  const app = await readFile(new URL("app.mjs", webDirectory), "utf8");
  const knobInteraction = app.slice(
    app.indexOf("function createKnob"),
    app.indexOf("function bindTransport")
  );

  assert.match(knobInteraction, /event\.clientX - drag\.startX/);
  assert.doesNotMatch(knobInteraction, /event\.clientY|drag\.startY|verticalDistance/);
});

test("knob drags show their formatted value in the pack display", async () => {
  const app = await readFile(new URL("app.mjs", webDirectory), "utf8");
  const markup = await readFile(new URL("index.html", webDirectory), "utf8");
  const stylesheet = await readFile(new URL("styles.css", webDirectory), "utf8");
  const knobInteraction = app.slice(
    app.indexOf("function createKnob"),
    app.indexOf("function bindTransport")
  );

  assert.match(knobInteraction, /showEditStatus\(`\$\{label\} · \$\{format\(nextValue\)\}`\)/);
  assert.match(knobInteraction, /hideEditStatus\(\)/);
  assert.match(markup, /<div class="pack-edit-status" id="packEditStatus"[^>]*><\/div>/);
  assert.doesNotMatch(markup, /edit-bubble/);
  assert.match(stylesheet, /\.pack-edit-status\.is-visible/);
  assert.match(stylesheet, /cursor:\s*ew-resize/);
});

test("step edits share the transient pack display and hide it on release", async () => {
  const app = await readFile(new URL("app.mjs", webDirectory), "utf8");
  const stepInteraction = app.slice(
    app.indexOf("function bindStepGesture"),
    app.indexOf("function renderPatterns")
  );

  assert.match(stepInteraction, /showEditStatus\(`\$\{note\}Vel \$\{step\.velocity\}`\)/);
  assert.match(stepInteraction, /hideEditStatus\(\)/);
});
