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

test("knob drags show their formatted value in the edit bubble", async () => {
  const app = await readFile(new URL("app.mjs", webDirectory), "utf8");
  const stylesheet = await readFile(new URL("styles.css", webDirectory), "utf8");
  const knobInteraction = app.slice(
    app.indexOf("function createKnob"),
    app.indexOf("function bindTransport")
  );

  assert.match(knobInteraction, /showEditBubble\(knob, `\$\{label\} · \$\{format\(nextValue\)\}`\)/);
  assert.match(knobInteraction, /hideEditBubble\(\)/);
  assert.match(stylesheet, /cursor:\s*ew-resize/);
});
