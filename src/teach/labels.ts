// Places label boxes around their anchors, fanned out from the cell's centre on
// screen, with left and right columns stacked so boxes never overlap.

export interface Box { x: number; y: number; w: number; h: number }

const OFFSET = 64;
const GAP = 4;

export function layoutLabels(anchors: { x: number; y: number }[], centre: { x: number; y: number }, sizes: { w: number; h: number }[]): Box[] {
  const boxes: Box[] = anchors.map((a, i) => {
    let dx = a.x - centre.x, dy = a.y - centre.y;
    const l = Math.hypot(dx, dy);
    if (l < 1) { const t = (i / anchors.length) * Math.PI * 2; dx = Math.cos(t); dy = Math.sin(t); } else { dx /= l; dy /= l; }
    const px = a.x + dx * OFFSET, py = a.y + dy * OFFSET * 0.6;
    const { w, h } = sizes[i];
    return { x: dx >= 0 ? px : px - w, y: py - h / 2, w, h };
  });
  // Resolve overlaps by pushing boxes apart vertically, lowest anchor goes lowest.
  const order = boxes.map((_, i) => i).sort((a, b) => anchors[a].y - anchors[b].y);
  for (let it = 0; it < 200; it++) {
    let moved = false;
    for (let p = 0; p < order.length; p++) for (let q = p + 1; q < order.length; q++) {
      const a = boxes[order[p]], b = boxes[order[q]];
      if (!(a.x < b.x + b.w && b.x < a.x + a.w)) continue;
      const overlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + GAP;
      if (overlap <= 0) continue;
      const [top, bottom] = a.y <= b.y ? [a, b] : [b, a];
      top.y -= overlap / 2;
      bottom.y += overlap / 2;
      moved = true;
    }
    if (!moved) break;
  }
  return boxes;
}
