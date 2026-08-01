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

export function getShiftModifierState({ buttonToggled = false, keyboardHeld = false } = {}) {
  return buttonToggled || keyboardHeld;
}

export function toggleShiftModifier(buttonToggled) {
  return !buttonToggled;
}
