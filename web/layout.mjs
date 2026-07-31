export const BASE_WIDTH = 1024;
export const BASE_HEIGHT = 576;
export const BASE_ASPECT_RATIO = BASE_WIDTH / BASE_HEIGHT;

export function calculateStageScale(viewportWidth, viewportHeight, horizontalInset = 0, verticalInset = 0) {
  const availableWidth = Math.max(0, viewportWidth - horizontalInset);
  const availableHeight = Math.max(0, viewportHeight - verticalInset);

  return Math.min(availableWidth / BASE_WIDTH, availableHeight / BASE_HEIGHT);
}

export function calculateRenderedStage(viewportWidth, viewportHeight, horizontalInset = 0, verticalInset = 0) {
  const scale = calculateStageScale(viewportWidth, viewportHeight, horizontalInset, verticalInset);

  return {
    scale,
    width: BASE_WIDTH * scale,
    height: BASE_HEIGHT * scale
  };
}
