export function isAppleMobile({
  userAgent = "",
  platform = "",
  maxTouchPoints = 0
} = {}) {
  return /iPhone|iPad|iPod/i.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1);
}

export function isMobileDevice({
  userAgent = "",
  userAgentDataMobile,
  platform = "",
  maxTouchPoints = 0
} = {}) {
  if (userAgentDataMobile === true) {
    return true;
  }

  return isAppleMobile({ userAgent, platform, maxTouchPoints }) ||
    /Android|Mobile|IEMobile|Opera Mini/i.test(userAgent);
}

export function isStandalone({
  displayModeStandalone = false,
  navigatorStandalone = false
} = {}) {
  return displayModeStandalone || navigatorStandalone;
}

export function shouldRequireMobileInstall({ mobile = false, standalone = false } = {}) {
  return mobile && !standalone;
}
