import {
  isAppleMobile,
  isMobileDevice,
  isStandalone,
  shouldRequireMobileInstall
} from "./install-mode.mjs";

const device = {
  userAgent: navigator.userAgent,
  userAgentDataMobile: navigator.userAgentData?.mobile,
  platform: navigator.platform,
  maxTouchPoints: navigator.maxTouchPoints
};
const standalone = isStandalone({
  displayModeStandalone: window.matchMedia("(display-mode: standalone)").matches,
  navigatorStandalone: navigator.standalone === true
});
const requireInstall = shouldRequireMobileInstall({
  mobile: isMobileDevice(device),
  standalone
});

if (requireInstall) {
  const installGate = document.querySelector("#installGate");
  const installButton = document.querySelector("#installButton");
  const installStatus = document.querySelector("#installStatus");
  const appleMobile = isAppleMobile(device);
  let deferredInstallPrompt = null;

  document.body.classList.remove("pwa-checking");
  document.body.classList.add("pwa-install-required");
  installGate.hidden = false;
  installGate.dataset.platform = appleMobile ? "ios" : "android";

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButton.hidden = false;
  });

  installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      return;
    }

    installButton.disabled = true;
    await deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;

    if (choice.outcome === "accepted") {
      installButton.hidden = true;
      installStatus.textContent = "Installed. Open Groovebox from your Home Screen.";
    } else {
      installButton.disabled = false;
    }
  });

  window.addEventListener("appinstalled", () => {
    installButton.hidden = true;
    installStatus.textContent = "Installed. Open Groovebox from your Home Screen.";
  });
} else {
  document.body.classList.remove("pwa-checking");
  await import("./app.mjs?v=13");
}
