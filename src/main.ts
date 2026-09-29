import './style.css';
import type { CellTypeId, Vec3, ViewMode } from './contracts';
import { STRAIN_FULL } from './teach/fields';
import { CELL_TYPES } from './cells';
import { TeachUi } from './ui/teach';
import { World } from './app/world';
import { raycast, rayPlane, screenRay, type Ray } from './app/pick';
import { startGrab } from './physics/grab';
import { axisAngleMat } from './math/mat3';
import { bladeMesh } from './cut/knife';
import { Renderer, type Camera } from './render/renderer';
import { VARIETIES, type Variety } from './render/palette';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('stage');
const strokeLine = document.querySelector('#stroke polyline') as SVGPolylineElement;
const status = document.querySelector('.status') as HTMLElement;
const statusText = $('status-text');

const REACH = 7;
const help = (w: World) => ({
  hand: `<b>Hand</b>${w.type.help} Scroll, or add a second finger, while holding to twist it. Drag the floor to look around. Click a label to learn more.`,
  knife: '<b>Knife</b>Draw a stroke across the cell. The blade comes down along it and splits every piece it crosses. Then turn the halves over and look at the faces.',
});
let teach: TeachUi;

let tool: 'hand' | 'knife' = 'hand';
let variety: Variety = VARIETIES[0];
let showMesh = false;

// Orbit camera around a target that follows the pieces.
const cam = { yaw: -0.42, pitch: 0.6, dist: 21, target: [1.1, 1.7, 0] };
let aspect = 16 / 10;
function camera(): Camera {
  const { yaw, pitch, target } = cam;
  // narrow screens pull back so the whole cell stays in view, and look past the control sheet
  const narrow = Math.max(1, 1.05 / aspect);
  const dist = cam.dist * narrow;
  const eye = [
    target[0] + dist * Math.sin(yaw) * Math.cos(pitch),
    target[1] + dist * Math.sin(pitch),
    target[2] + dist * Math.cos(yaw) * Math.cos(pitch),
  ];
  return { eye, target, fovY: (30 * Math.PI) / 180, lensShiftY: aspect < 0.9 ? 0.13 : 0 };
}
function camForward(): Vec3 {
  const c = camera();
  const d = [c.target[0] - c.eye[0], c.target[1] - c.eye[1], c.target[2] - c.eye[2]];
  const l = Math.hypot(d[0], d[1], d[2]);
  return [d[0] / l, d[1] / l, d[2] / l];
}

function toast(msg: string) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout((toast as unknown as { h: number }).h);
  (toast as unknown as { h: number }).h = window.setTimeout(() => t.classList.remove('show'), 2200);
}

function fail(msg: string) {
  $('fallback').hidden = false;
  $('fallback-msg').textContent = msg;
  status.classList.add('error');
  statusText.textContent = 'WebGPU · Unavailable';
  canvas.style.display = 'none';
}

async function main() {
  let renderer: Renderer;
  try {
    renderer = await Renderer.create(canvas);
  } catch (e) {
    fail(`${(e as Error).message} Try a recent Chrome, Edge or Safari (18+), or Firefox with WebGPU enabled.`);
    return;
  }
  renderer.device.lost.then((info) => fail(`The GPU device was lost (${info.message || info.reason}). Reload the page to try again.`));

  statusText.textContent = 'WebGPU · Building';
  await new Promise((r) => setTimeout(r, 30));
  const initial = (new URLSearchParams(location.search).get('cell') as CellTypeId) || 'yeast';
  const world = new World(CELL_TYPES.some((c) => c.id === initial) ? initial : 'yeast');
  renderer.setAnatomy(world.an);
  statusText.textContent = 'WebGPU · Live';

  teach = new TeachUi(world);
  setupUi(world, renderer);
  setupInput(world, renderer);

  let last = performance.now(), frame = 0;
  const debug = new URLSearchParams(location.search).has('debug');
  const loop = (now: number) => {
    aspect = renderer.aspect;
    const dt = (now - last) / 1000;
    last = now;
    world.update(dt);
    // follow the pieces, gently
    const c = world.centre();
    const k = 1 - Math.exp(-dt * 2.5);
    cam.target[0] += (c[0] - cam.target[0]) * k;
    cam.target[1] += (Math.min(3, Math.max(1.2, c[1])) - cam.target[1]) * k;
    cam.target[2] += (c[2] - cam.target[2]) * k;
    const c0 = camera();
    renderer.render(world.pieces, c0, {
      variety, showMesh, time: now / 1000,
      knife: world.knife ? bladeMesh(world.knife) : null,
      highlight: teach.highlight, hidden: teach.hidden, absorb: world.type.absorb, view: world.view,
    });
    teach.update(renderer.viewProj, c0.eye, c0.target, canvas.clientWidth, canvas.clientHeight);
    if (frame++ % 6 === 0) updateStats(world);
    if (debug && frame % 30 === 0) statusText.textContent = `step ${world.stepMs.toFixed(1)} ms`;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function updateStats(world: World) {
  const s = world.stats();
  $('s-mass').textContent = `≈${Math.round(s.massPg)}`;
  $('s-vol').textContent = s.volumePct.toFixed(1);
  $('s-ke').textContent = s.kineticMicroJ < 100 ? s.kineticMicroJ.toFixed(2) : Math.round(s.kineticMicroJ).toString();
  $('s-pieces').textContent = String(s.pieces);
}

/** Everything on the page that depends on the cell type. */
function showType(world: World) {
  const t = world.type;
  $('title1').textContent = t.title[0];
  $('title2').textContent = t.title[1];
  $('tagline').innerHTML = t.tagline.join('<br />');
  $('about').textContent = t.about;
  $('help').innerHTML = help(world)[tool];
  cam.yaw = t.camera.yaw; cam.pitch = t.camera.pitch; cam.dist = t.camera.dist;
  const c = world.centre();
  cam.target = [c[0], Math.min(3, Math.max(1.2, c[1])), c[2]];
  teach.setType(t, variety);
  showStage(world);
  const url = new URL(location.href);
  url.searchParams.set('cell', t.id);
  history.replaceState(null, '', url);
}

/** The cell-cycle slider, for cell types that have stages. */
function showStage(world: World) {
  const stages = world.type.stages;
  $('stage-group').hidden = !stages;
  if (!stages) return;
  const input = $<HTMLInputElement>('cycle');
  $('stage-label').textContent = world.type.stageLabel ?? 'Stage';
  input.setAttribute('aria-label', world.type.stageLabel ?? 'Stage');
  input.max = String(stages.length - 1);
  input.value = String(world.stage);
  $('stage-ticks').innerHTML = stages.map((st, i) => `<span style="--at:${(100 * i) / (stages.length - 1)}%;--shift:${i === 0 ? '0' : i === stages.length - 1 ? '-100%' : '-50%'}" class="${i === world.stage ? 'on' : ''}">${st.name}</span>`).join('');
  previewStage(world, world.stage);
}

function previewStage(world: World, i: number) {
  const st = world.type.stages?.[i];
  if (!st) return;
  $('stage-title').textContent = st.title;
  $('stage-blurb').textContent = st.blurb;
}

function showColorbar(view: ViewMode) {
  $('colorbar').hidden = view === 'anatomy';
  $('cb-title').textContent = 'Deformation (stretch or squeeze)';
  $('cb-min').textContent = '0%';
  $('cb-max').textContent = `${Math.round(STRAIN_FULL * 100)}%+`;
}

function setupUi(world: World, renderer: Renderer) {
  const helpEl = $('help');
  const select = $<HTMLSelectElement>('cell-type');
  select.innerHTML = CELL_TYPES.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
  select.value = world.type.id;
  select.addEventListener('change', async () => {
    statusText.textContent = 'WebGPU · Building';
    select.disabled = true;
    await new Promise((r) => setTimeout(r, 30));
    world.setCellType(select.value as CellTypeId);
    renderer.setAnatomy(world.an);
    showType(world);
    select.disabled = false;
    statusText.textContent = world.paused ? 'WebGPU · Paused' : 'WebGPU · Live';
    select.blur();
  });
  showType(world);
  $('labels-btn').addEventListener('click', () => teach.toggleLabels());

  const stageInput = $<HTMLInputElement>('cycle');
  const setStage = async (i: number) => {
    if (i === world.stage) return;
    statusText.textContent = 'WebGPU · Building';
    await new Promise((r) => setTimeout(r, 20));
    world.setCellType(world.type.id, i);
    renderer.setAnatomy(world.an);
    teach.setType(world.type, variety);
    showStage(world);
    statusText.textContent = world.paused ? 'WebGPU · Paused' : 'WebGPU · Live';
  };
  stageInput.addEventListener('input', () => previewStage(world, Number(stageInput.value)));
  stageInput.addEventListener('change', () => setStage(Number(stageInput.value)));
  const stepStage = (d: number) => {
    const n = world.type.stages?.length ?? 0;
    if (n) setStage(Math.max(0, Math.min(n - 1, world.stage + d)));
  };

  document.querySelectorAll<HTMLButtonElement>('.view').forEach((b) => b.addEventListener('click', () => {
    const v = b.dataset.view as ViewMode;
    world.setView(v);
    document.querySelectorAll<HTMLButtonElement>('.view').forEach((o) => {
      o.classList.toggle('active', o === b);
      o.setAttribute('aria-checked', String(o === b));
    });
    showColorbar(v);
  }));
  document.querySelectorAll<HTMLButtonElement>('.tool').forEach((b) => b.addEventListener('click', () => {
    tool = b.dataset.tool as typeof tool;
    document.querySelectorAll<HTMLButtonElement>('.tool').forEach((o) => {
      o.classList.toggle('active', o === b);
      o.setAttribute('aria-checked', String(o === b));
    });
    helpEl.innerHTML = help(world)[tool];
    canvas.classList.toggle('knife', tool === 'knife');
  }));

  const sw = $('swatches');
  VARIETIES.forEach((v, i) => {
    const b = document.createElement('button');
    b.className = 'swatch' + (i === 0 ? ' active' : '');
    b.innerHTML = `<span class="chip" style="--a:${v.swatch[0]};--b:${v.swatch[1]}"></span>${v.name}`;
    b.addEventListener('click', () => {
      variety = v;
      sw.querySelectorAll('.swatch').forEach((o) => o.classList.toggle('active', o === b));
      applyTheme();
      teach.setVariety(v);
    });
    sw.appendChild(b);
  });
  applyTheme();

  const bindSlider = (id: string, set: (x: number) => void) => {
    const el = $<HTMLInputElement>(id), out = $(`${id}-out`);
    el.addEventListener('input', () => { set(Number(el.value)); out.textContent = Number(el.value).toFixed(2); });
  };
  bindSlider('firm', (x) => (world.params.firmness = x));
  bindSlider('damp', (x) => (world.params.damping = x));
  $('nudge').addEventListener('click', () => world.nudge());
  $('reset').addEventListener('click', () => world.reset());
  $<HTMLInputElement>('slow').addEventListener('change', (e) => (world.slow = (e.target as HTMLInputElement).checked));
  $<HTMLInputElement>('mesh').addEventListener('change', (e) => (showMesh = (e.target as HTMLInputElement).checked));
  const pause = $('pause');
  pause.addEventListener('click', () => {
    world.paused = !world.paused;
    pause.textContent = world.paused ? 'Resume' : 'Pause';
    statusText.textContent = world.paused ? 'WebGPU · Paused' : 'WebGPU · Live';
  });
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (e.key === ' ') { e.preventDefault(); pause.click(); }
    if (e.key === 'h') (document.querySelector('[data-tool="hand"]') as HTMLButtonElement).click();
    if (e.key === 'k') (document.querySelector('[data-tool="knife"]') as HTMLButtonElement).click();
    if (e.key === 'n') world.nudge();
    if (e.key === 'r') world.reset();
    if (e.key === 'l') teach.toggleLabels();
    if (e.key === '[') stepStage(-1);
    if (e.key === ']') stepStage(1);
    if (e.key === 'Escape') teach.closeCard();
  });
}

function applyTheme() {
  const root = document.documentElement;
  root.style.setProperty('--bg', variety.background);
  root.style.setProperty('--ink', variety.ink);
  root.dataset.variety = variety.id;
}

function setupInput(world: World, renderer: Renderer) {
  const pointers = new Map<number, { x: number; y: number }>();
  let mode: 'none' | 'grab' | 'orbit' | 'stroke' = 'none';
  let grabStart: Vec3 = [0, 0, 0];
  let twist = 0, twistRef = 0;
  let stroke: { x: number; y: number }[] = [];

  const ray = (x: number, y: number): Ray => {
    renderer.cameraMatrices(camera());
    return screenRay(renderer.viewProj, x, y, canvas.clientWidth, canvas.clientHeight);
  };
  const setTwist = () => {
    if (!world.grab) return;
    const f = camForward();
    world.grab.rot = axisAngleMat(f[0], f[1], f[2], twist);
  };
  const pairAngle = () => {
    const [a, b] = [...pointers.values()];
    return Math.atan2(b.y - a.y, b.x - a.x);
  };

  canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 2 && mode === 'grab') { twistRef = pairAngle() - twist; return; }
    if (pointers.size > 1) return;
    if (tool === 'knife') {
      if (world.knife) return;
      mode = 'stroke';
      stroke = [{ x: e.offsetX, y: e.offsetY }];
      return;
    }
    const hit = raycast(world.pieces, ray(e.offsetX, e.offsetY));
    if (hit) {
      mode = 'grab';
      grabStart = hit.point;
      twist = 0;
      world.grab = startGrab(hit.piece, hit.point, 0.9);
      canvas.classList.add('grabbing');
    } else mode = 'orbit';
  });

  canvas.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const dx = e.offsetX - prev.x, dy = e.offsetY - prev.y;
    pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (mode === 'grab' && pointers.size === 2) { twist = pairAngle() - twistRef; setTwist(); return; }
    if (mode === 'grab' && world.grab) {
      const p = rayPlane(ray(e.offsetX, e.offsetY), camForward(), grabStart);
      if (!p) return;
      const off = [p[0] - grabStart[0], p[1] - grabStart[1], p[2] - grabStart[2]];
      const l = Math.hypot(off[0], off[1], off[2]);
      const s = l > REACH ? REACH / l : 1;
      world.grab.target = [grabStart[0] + off[0] * s, Math.max(0.1, grabStart[1] + off[1] * s), grabStart[2] + off[2] * s];
    } else if (mode === 'orbit') {
      cam.yaw -= dx * 0.006;
      cam.pitch = Math.min(1.35, Math.max(0.18, cam.pitch + dy * 0.005));
    } else if (mode === 'stroke') {
      stroke.push({ x: e.offsetX, y: e.offsetY });
      strokeLine.setAttribute('points', stroke.map((p) => `${p.x},${p.y}`).join(' '));
    }
  });

  const end = (e: PointerEvent) => {
    if (!pointers.delete(e.pointerId)) return;
    if (pointers.size > 0) return;
    if (mode === 'grab') { world.grab = null; canvas.classList.remove('grabbing'); }
    if (mode === 'stroke') finishStroke();
    mode = 'none';
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (mode === 'grab' && world.grab) { twist += e.deltaY * 0.005; setTwist(); return; }
    cam.dist = Math.min(45, Math.max(9, cam.dist * Math.exp(e.deltaY * 0.001)));
  }, { passive: false });

  function finishStroke() {
    const pts = stroke;
    stroke = [];
    setTimeout(() => strokeLine.setAttribute('points', ''), 220);
    if (pts.length < 2 || Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y) < 24) return;
    // Read the stroke on the surface it was drawn over; fall back to a horizontal plane at mid-height.
    const hits: Vec3[] = [];
    const nSamples = Math.min(32, pts.length);
    for (let i = 0; i < nSamples; i++) {
      const p = pts[Math.round((i * (pts.length - 1)) / Math.max(1, nSamples - 1))];
      const h = raycast(world.pieces, ray(p.x, p.y));
      if (h) hits.push(h.point);
    }
    const midY = world.centre()[1];
    const onPlane = (p: { x: number; y: number }) => rayPlane(ray(p.x, p.y), [0, 1, 0], [0, midY, 0]);
    let a: Vec3 | null = hits.length >= 2 ? hits[0] : onPlane(pts[0]);
    let b: Vec3 | null = hits.length >= 2 ? hits[hits.length - 1] : onPlane(pts[pts.length - 1]);
    if (hits.length >= 2 && Math.hypot(b![0] - a![0], b![2] - a![2]) < 0.5) { a = onPlane(pts[0]); b = onPlane(pts[pts.length - 1]); }
    if (!a || !b) { toast('Draw the stroke over the board.'); return; }
    const r = world.cut(a, b, camForward());
    if (r === 'miss') toast('Missed. Draw a stroke across the cell.');
    if (r === 'full') toast('That is plenty of slices. Reset to start again.');
  }
}

main();
