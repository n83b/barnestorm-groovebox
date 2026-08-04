import { restoreState } from "./state.mjs?v=dev";

const DEMO_PROJECT_PATHS = new Map([
  [
    "2026-week-32-pumpin-techno",
    "./assets/packs/2026-week-32-pumpin-techno/demo-project.json"
  ]
]);

export function getDemoProjectUrl(packId, moduleUrl = import.meta.url) {
  const path = DEMO_PROJECT_PATHS.get(packId);
  return path ? new URL(path, moduleUrl).href : null;
}

export async function loadDemoProject(packId, {
  fetchImpl = globalThis.fetch?.bind(globalThis),
  moduleUrl = import.meta.url
} = {}) {
  const url = getDemoProjectUrl(packId, moduleUrl);
  if (!url) return null;
  if (!fetchImpl) throw new Error("Demo project loading is unavailable.");

  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Could not load the demo patterns (${response.status}).`);
  }

  const project = await response.json();
  if (project?.packId !== packId) {
    throw new Error("The demo patterns belong to a different sound pack.");
  }

  return restoreState(project);
}
