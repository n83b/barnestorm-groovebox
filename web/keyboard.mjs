const INTERACTIVE_TARGET_SELECTOR = [
  "button",
  "input",
  "select",
  "textarea",
  "a[href]",
  '[contenteditable]:not([contenteditable="false"])',
  '[role="button"]',
  '[role="slider"]'
].join(", ");

export function shouldToggleTransportFromKeydown(event) {
  const isSpace = event.code === "Space" || event.key === " ";
  const hasModifier = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
  const hasInteractiveTarget = Boolean(event.target?.closest?.(INTERACTIVE_TARGET_SELECTOR));
  const hasKnobTarget = Boolean(
    event.target?.matches?.('input.knob-input[type="range"]')
  );
  const hasPlayButtonTarget = Boolean(event.target?.matches?.("#playButton"));

  return isSpace
    && !event.repeat
    && !event.defaultPrevented
    && !hasModifier
    && (!hasInteractiveTarget || hasKnobTarget || hasPlayButtonTarget);
}

export function getShiftModifierState({
  buttonToggled = false,
  keyboardHeld = false,
  touchHeld = false
} = {}) {
  return buttonToggled || keyboardHeld || touchHeld;
}

export function toggleShiftModifier(buttonToggled) {
  return !buttonToggled;
}

export function getShiftActionModifier({
  pointerType,
  shiftAtPointerDown = false,
  currentShift = false
} = {}) {
  return pointerType === "touch" ? shiftAtPointerDown : currentShift;
}

export function isMomentaryTouchShift(
  { pointerType, duration = 0, usedWhileHeld = false } = {},
  minimumHoldDuration = 240
) {
  return pointerType === "touch"
    && (usedWhileHeld || duration >= minimumHoldDuration);
}

export function isDoubleTap(
  previousTap,
  currentTap,
  { maximumDelay = 360, maximumDistance = 28 } = {}
) {
  if (!previousTap || !currentTap) return false;
  if (
    previousTap.pointerType &&
    currentTap.pointerType &&
    previousTap.pointerType !== currentTap.pointerType
  ) {
    return false;
  }

  const delay = currentTap.time - previousTap.time;
  const distance = Math.hypot(
    currentTap.x - previousTap.x,
    currentTap.y - previousTap.y
  );
  return delay > 0 && delay <= maximumDelay && distance <= maximumDistance;
}
