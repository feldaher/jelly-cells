const NICE = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];

/** A round scale-bar length for the current zoom, between ~50 and 160 px wide. */
export function scaleBar(pxPerUm: number): { um: number; px: number } {
  let best = NICE[0];
  for (const um of NICE) if (um * pxPerUm <= 160) best = um;
  return { um: best, px: best * pxPerUm };
}

/** A length given in µm as text, in nm when it is below half a micrometre: "2 µm", "50 nm". */
export function lengthText(um: number, digits = 0): string {
  const round = (x: number) => (digits ? x.toFixed(digits) : String(Math.round(x * 1000) / 1000));
  return um < 0.5 ? `${round(um * 1000)} nm` : `${round(um)} µm`;
}

/** A mass given in pg, in the unit that keeps it readable: pg, fg (10⁻³ pg) or ag (10⁻⁶ pg). */
export function massText(pg: number): { value: string; unit: string } {
  for (const [unit, k] of [['pg', 1], ['fg', 1e3], ['ag', 1e6]] as const) {
    const x = pg * k;
    if (x >= 0.1 || unit === 'ag') return { value: x >= 10 ? String(Math.round(x)) : x.toFixed(1), unit };
  }
  return { value: '0', unit: 'pg' };
}
