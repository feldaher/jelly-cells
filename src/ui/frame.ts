// Where on screen the cell can be seen: the canvas minus the controls, title and
// readout laid over it, and the camera framing that centres and fits the cell there.

export interface Rect { left: number; top: number; right: number; bottom: number }

/** Share of the cell's view height the cell may fill before the camera pulls back. */
const FILL = 0.55;
/** The cell wants a view at least this wide for its height. */
const MIN_ASPECT = 1.05;

/**
 * The part of a w × h screen left free by the obstacles. An obstacle only trims an
 * edge when it spans most of that edge: a sheet along the bottom, a column down the
 * side, a bar across the top. Small blocks in corners are left for labels to avoid.
 */
export function freeArea(obstacles: Rect[], w: number, h: number): Rect {
  const free: Rect = { left: 0, top: 0, right: w, bottom: h };
  for (const o of obstacles) {
    const ow = o.right - o.left, oh = o.bottom - o.top;
    if (ow <= 0 || oh <= 0) continue;
    // which edge it hangs from: the side its middle is on
    const below = o.top + o.bottom > h, right = o.left + o.right > w;
    if (ow > w / 2) {
      if (below) free.bottom = Math.min(free.bottom, o.top);
      else free.top = Math.max(free.top, o.bottom);
    } else if (oh > h / 2) {
      if (right) free.right = Math.min(free.right, o.left);
      else free.left = Math.max(free.left, o.right);
    }
  }
  return free;
}

/**
 * Lens shifts (fractions of the screen, + = image right / up) that put the camera target
 * in the middle of the free area, and how much further back the camera must sit to fit it.
 */
export function framing(free: Rect, w: number, h: number): { lensShiftX: number; lensShiftY: number; distScale: number } {
  const fw = Math.max(1, free.right - free.left), fh = Math.max(1, free.bottom - free.top);
  return {
    lensShiftX: (free.left + free.right) / 2 / w - 0.5,
    lensShiftY: 0.5 - (free.top + free.bottom) / 2 / h,
    distScale: Math.max(1, (MIN_ASPECT * h) / fw, (FILL * h) / fh),
  };
}
