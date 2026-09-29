const NICE = [0.5, 1, 2, 5, 10, 20, 50, 100];

/** A round scale-bar length for the current zoom, between ~50 and 160 px wide. */
export function scaleBar(pxPerUm: number): { um: number; px: number } {
  let best = NICE[0];
  for (const um of NICE) if (um * pxPerUm <= 160) best = um;
  return { um: best, px: best * pxPerUm };
}
