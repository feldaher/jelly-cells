// Teaching aids on top of the canvas: labels with leader lines and info cards,
// a key that hides / isolates / highlights organelles, the cut report and a scale bar.

import { Mat, type CellType, type Label, type Material, type Vec3 } from '../contracts';
import type { World } from '../app/world';
import { layoutLabels } from '../teach/labels';
import { scaleBar } from '../teach/scale';
import { notableEntries } from '../teach/section';
import { materialHex, type Variety } from '../render/palette';
import type { M4 } from '../math/mat4';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const SVG = 'http://www.w3.org/2000/svg';

interface LabelEls { label: Label; box: HTMLButtonElement; dot: HTMLSpanElement; line: SVGLineElement; size?: { w: number; h: number } }

export class TeachUi {
  labelsOn = true;
  /** Materials hidden from view (bitmask by material id). */
  hidden = 0;
  private hover: number | null = null;
  private pinned: Label | null = null;
  private els: LabelEls[] = [];
  private type!: CellType;
  private variety!: Variety;
  private lastCutSerial = 0;
  private layer = $('labels');
  private leaders = document.getElementById('leaders') as unknown as SVGSVGElement;

  constructor(private world: World) {
    $('card-close').addEventListener('click', () => this.closeCard());
    $('cut-close').addEventListener('click', () => ($('cut-report').hidden = true));
    $('show-all').addEventListener('click', () => { this.hidden = 0; this.renderKey(); });
  }

  /** The material to spotlight right now, or -1. */
  get highlight(): number {
    if (this.hover !== null) return this.hover;
    return this.pinned?.material ?? -1;
  }

  setType(type: CellType, variety: Variety) {
    this.type = type;
    this.variety = variety;
    this.hidden = 0;
    this.hover = null;
    this.closeCard();
    $('cut-report').hidden = true;
    this.lastCutSerial = this.world.lastCut?.serial ?? 0;
    this.buildLabels();
    this.renderKey();
  }

  setVariety(v: Variety) {
    this.variety = v;
    this.renderKey();
    this.els.forEach((e) => e.box.style.setProperty('--c', this.colorOf(e.label)));
  }

  toggleLabels(on = !this.labelsOn) {
    this.labelsOn = on;
    this.layer.hidden = !on;
    this.leaders.style.display = on ? '' : 'none';
    const b = $('labels-btn');
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
    if (!on) this.hover = null;
  }

  private colorOf(l: Label): string {
    return l.material === undefined ? 'var(--ink)' : materialHex(this.variety, l.material);
  }

  private buildLabels() {
    this.layer.replaceChildren();
    this.leaders.replaceChildren();
    this.els = this.world.labels.map((label) => {
      const box = document.createElement('button');
      box.className = 'lbl';
      box.innerHTML = `<i></i>${label.name}`;
      box.style.setProperty('--c', this.colorOf(label));
      box.addEventListener('pointerenter', () => { if (label.material !== undefined) this.hover = label.material; });
      box.addEventListener('pointerleave', () => { this.hover = null; });
      box.addEventListener('click', () => this.openCard(label));
      const dot = document.createElement('span');
      dot.className = 'lbl-dot';
      const line = document.createElementNS(SVG, 'line');
      this.layer.append(box, dot);
      this.leaders.append(line);
      return { label, box, dot, line };
    });
  }

  private openCard(l: Label) {
    this.pinned = l;
    $('card-name').textContent = l.name;
    $('card-size').textContent = l.size;
    $('card-blurb').textContent = l.blurb;
    $('card').style.setProperty('--c', this.colorOf(l));
    $('card').hidden = false;
    this.els.forEach((e) => e.box.classList.toggle('pinned', e.label === l));
  }

  closeCard() {
    this.pinned = null;
    $('card').hidden = true;
    this.els.forEach((e) => e.box.classList.remove('pinned'));
  }

  private isHidden(m: Material | undefined) {
    return m !== undefined && ((this.hidden >> m) & 1) === 1;
  }

  renderKey() {
    const ul = $('legend');
    ul.replaceChildren();
    for (const { material, name } of this.type.key) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      const hideable = material !== Mat.Cytoplasm;
      b.className = 'key-item' + (this.isHidden(material) ? ' off' : '') + (hideable ? '' : ' fixed');
      b.innerHTML = `<i style="--c:${materialHex(this.variety, material)}"></i>${name}`;
      b.title = hideable ? 'Click to hide · Shift-click to show only this' : 'The jelly itself';
      b.setAttribute('aria-pressed', String(!this.isHidden(material)));
      b.addEventListener('pointerenter', () => { this.hover = material === Mat.Cytoplasm ? null : material; });
      b.addEventListener('pointerleave', () => { this.hover = null; });
      b.addEventListener('click', (e) => {
        if (!hideable) return;
        if (e.shiftKey) {
          // isolate: hide every other hideable material
          this.hidden = 0;
          for (const k of this.type.key) if (k.material !== material && k.material !== Mat.Cytoplasm) this.hidden |= 1 << k.material;
        } else {
          this.hidden ^= 1 << material;
        }
        this.renderKey();
      });
      li.append(b);
      ul.append(li);
    }
    $('show-all').hidden = this.hidden === 0;
  }

  /** Per frame: place labels, update the scale bar, show a new cut report. */
  update(viewProj: M4, eye: number[], target: number[], w: number, h: number) {
    this.updateCutReport();
    this.updateScaleBar(viewProj, eye, target, w);
    if (!this.labelsOn) return;

    const project = (p: Vec3) => {
      const x = viewProj[0] * p[0] + viewProj[4] * p[1] + viewProj[8] * p[2] + viewProj[12];
      const y = viewProj[1] * p[0] + viewProj[5] * p[1] + viewProj[9] * p[2] + viewProj[13];
      const ww = viewProj[3] * p[0] + viewProj[7] * p[1] + viewProj[11] * p[2] + viewProj[15];
      if (ww <= 0.01) return null;
      return { x: ((x / ww + 1) / 2) * w, y: ((1 - y / ww) / 2) * h };
    };
    const positions = new Map(this.world.labelPositions().map((p) => [p.label, p.pos]));
    const shown: { e: LabelEls; a: { x: number; y: number } }[] = [];
    for (const e of this.els) {
      const pos = positions.get(e.label);
      const a = pos && !this.isHidden(e.label.material) ? project(pos) : null;
      const visible = !!a && a.x > -50 && a.x < w + 50 && a.y > -50 && a.y < h + 50;
      e.box.hidden = !visible;
      e.dot.hidden = !visible;
      e.line.style.display = visible ? '' : 'none';
      if (visible) {
        e.size ??= { w: e.box.offsetWidth, h: e.box.offsetHeight };
        shown.push({ e, a: a! });
      }
    }
    if (!shown.length) return;
    const c = project(target as Vec3) ?? { x: w / 2, y: h / 2 };
    const boxes = layoutLabels(shown.map((s) => s.a), c, shown.map((s) => s.e.size!));
    // keep clear of the control panel on wide screens
    const panel = document.getElementById('panel')!.getBoundingClientRect();
    const right = w > 900 ? Math.min(w, panel.left) - 10 : w - 8;
    shown.forEach(({ e, a }, i) => {
      const b = boxes[i];
      const bx = Math.min(Math.max(b.x, 8), right - b.w), by = Math.min(Math.max(b.y, 8), h - b.h - 8);
      e.box.style.transform = `translate(${bx}px, ${by}px)`;
      e.dot.style.transform = `translate(${a.x}px, ${a.y}px)`;
      const ex = bx > a.x ? bx : bx + b.w;
      e.line.setAttribute('x1', String(a.x)); e.line.setAttribute('y1', String(a.y));
      e.line.setAttribute('x2', String(ex)); e.line.setAttribute('y2', String(by + b.h / 2));
      const active = this.highlight >= 0 && e.label.material === this.highlight;
      e.box.classList.toggle('active', active);
    });
  }

  private updateScaleBar(viewProj: M4, eye: number[], target: number[], w: number) {
    // screen length of one sim unit at the target, sideways to the view
    const f = [target[0] - eye[0], target[2] - eye[2]];
    const l = Math.hypot(f[0], f[1]) || 1;
    const right: Vec3 = [-f[1] / l, 0, f[0] / l];
    const px = (p: number[]) => {
      const x = viewProj[0] * p[0] + viewProj[4] * p[1] + viewProj[8] * p[2] + viewProj[12];
      const ww = viewProj[3] * p[0] + viewProj[7] * p[1] + viewProj[11] * p[2] + viewProj[15];
      return ((x / ww + 1) / 2) * w;
    };
    const pxPerUnit = Math.abs(px([target[0] + right[0], target[1], target[2] + right[2]]) - px(target));
    const bar = scaleBar(pxPerUnit / this.type.umPerUnit);
    const el = $('scalebar');
    (el.firstElementChild as HTMLElement).style.width = `${bar.px}px`;
    (el.lastElementChild as HTMLElement).textContent = `${bar.um} µm`;
  }

  private updateCutReport() {
    const cut = this.world.lastCut;
    if (!cut || cut.serial === this.lastCutSerial) return;
    this.lastCutSerial = cut.serial;
    const name = (m: Material) => this.type.key.find((k) => k.material === m)?.name ?? 'Other';
    const total = cut.entries.reduce((a, e) => a + e.areaUm2, 0);
    const rows = notableEntries(cut.entries).map((e) => {
      const detail = e.count > 1 ? `${e.count} profiles, up to ${fmt(e.widthUm)} µm` : `${fmt(e.widthUm)} µm across`;
      return `<li><i style="--c:${materialHex(this.variety, e.material)}"></i><b>${name(e.material)}</b><span>${detail}</span></li>`;
    });
    $('cut-list').innerHTML = rows.length ? rows.join('') : '<li class="none">Only cytoplasm. Try cutting closer to the middle.</li>';
    $('cut-area').textContent = `Section ≈ ${fmt(total)} µm²`;
    $('cut-report').hidden = false;
  }
}

function fmt(x: number) {
  return x >= 10 ? Math.round(x).toString() : x.toFixed(1);
}
