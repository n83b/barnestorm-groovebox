import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isAppleMobile,
  isMobileDevice,
  isStandalone,
  shouldRequireMobileInstall
} from "../web/install-mode.mjs";

const webDirectory = new URL("../web/", import.meta.url);

test("declares a standalone landscape web app for Home Screen launch", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("manifest.webmanifest", webDirectory), "utf8")
  );

  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.orientation, "landscape");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));
});

test("ships correctly sized iPhone and install icons", async () => {
  const expectedSizes = new Map([
    ["apple-touch-icon.png", 180],
    ["icon-192.png", 192],
    ["icon-512.png", 512],
    ["icon-maskable-512.png", 512]
  ]);

  for (const [filename, expectedSize] of expectedSizes) {
    const png = await readFile(new URL(`icons/${filename}`, webDirectory));
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.readUInt32BE(16), expectedSize);
    assert.equal(png.readUInt32BE(20), expectedSize);
  }
});

test("links the manifest, Apple metadata and app-shell registration", async () => {
  const html = await readFile(new URL("index.html", webDirectory), "utf8");
  const registration = await readFile(new URL("pwa.mjs", webDirectory), "utf8");

  assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /rel="apple-touch-icon"/);
  assert.match(html, /src="\.\/bootstrap\.mjs\?v=1"/);
  assert.doesNotMatch(html, /src="\.\/app\.mjs/);
  assert.match(html, /id="installGate"/);
  assert.match(registration, /serviceWorker\.register\("\.\/service-worker\.js"/);
});

test("requires Home Screen launch on mobile but not desktop", () => {
  const iphone = {
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    platform: "iPhone",
    maxTouchPoints: 5
  };
  const ipad = {
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
    platform: "MacIntel",
    maxTouchPoints: 5
  };
  const desktop = {
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    platform: "MacIntel",
    maxTouchPoints: 0
  };

  assert.equal(isAppleMobile(iphone), true);
  assert.equal(isAppleMobile(ipad), true);
  assert.equal(isMobileDevice(iphone), true);
  assert.equal(isMobileDevice(ipad), true);
  assert.equal(isMobileDevice(desktop), false);
  assert.equal(shouldRequireMobileInstall({ mobile: true, standalone: false }), true);
  assert.equal(shouldRequireMobileInstall({ mobile: true, standalone: true }), false);
  assert.equal(shouldRequireMobileInstall({ mobile: false, standalone: false }), false);
});

test("recognises both standards-based and iOS standalone modes", () => {
  assert.equal(isStandalone({ displayModeStandalone: true }), true);
  assert.equal(isStandalone({ navigatorStandalone: true }), true);
  assert.equal(isStandalone(), false);
});
