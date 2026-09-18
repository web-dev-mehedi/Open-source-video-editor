/**
 * High-performance Canvas Renderer Utility for Video/Image Clips with Crop & Transform Support.
 */

export interface CropRect {
  top: number;    // percent 0-100
  bottom: number; // percent 0-100
  left: number;   // percent 0-100
  right: number;  // percent 0-100
}

/**
 * Draws a cropped video/image slice directly onto a 2D canvas context.
 */
export function renderCroppedClip(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  videoOrImg: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  destX: number,
  destY: number,
  destWidth: number,
  destHeight: number,
  crop: CropRect = { top: 0, bottom: 0, left: 0, right: 0 }
): void {
  // Convert percentage crops (0-100) to actual pixel coordinates on source media
  const cropLeftPx = Math.max(0, Math.min(sourceWidth - 2, (crop.left / 100) * sourceWidth));
  const cropRightPx = Math.max(0, Math.min(sourceWidth - cropLeftPx - 1, (crop.right / 100) * sourceWidth));
  const cropTopPx = Math.max(0, Math.min(sourceHeight - 2, (crop.top / 100) * sourceHeight));
  const cropBottomPx = Math.max(0, Math.min(sourceHeight - cropTopPx - 1, (crop.bottom / 100) * sourceHeight));

  const sx = cropLeftPx;
  const sy = cropTopPx;
  const sWidth = Math.max(1, sourceWidth - cropLeftPx - cropRightPx);
  const sHeight = Math.max(1, sourceHeight - cropTopPx - cropBottomPx);

  // Draw cropped slice to target canvas destination
  ctx.drawImage(
    videoOrImg,
    sx,
    sy,
    sWidth,
    sHeight,
    destX,
    destY,
    destWidth,
    destHeight
  );
}
