// WebGPU renderer. Per frame:
//   1. key-light shadow map and a bottom-up "floor map" (height of the body over the floor)
//   2. opaque scene: floor, organelles (clipped at knife planes), knife
//   3. per piece, back to front: back-face depth → jelly front faces refracting the scene
//   4. composite to the canvas (+ tet edges when "Show mesh" is on)

import type { Anatomy, Piece, SkinMesh, Vec3, ViewMode } from '../contracts';
import { packAnatomyGPU } from '../anatomy/sdf';
import { lookAt, mul, ortho, perspective, type M4 } from '../math/mat4';
import { packPalette, type Variety } from './palette';
import commonWgsl from './shaders/common.wgsl?raw';
import shadowWgsl from './shaders/shadowmaps.wgsl?raw';
import depthWgsl from './shaders/depth.wgsl?raw';
import floorWgsl from './shaders/floor.wgsl?raw';
import organelleWgsl from './shaders/organelle.wgsl?raw';
import jellyWgsl from './shaders/jelly.wgsl?raw';
import bladeWgsl from './shaders/blade.wgsl?raw';
import blitWgsl from './shaders/blit.wgsl?raw';
import linesWgsl from './shaders/lines.wgsl?raw';

export interface Camera {
  eye: number[];
  target: number[];
  fovY: number;
  /** Shifts the image up by this much of the screen height (off-centre lens). */
  lensShiftY?: number;
}

/** A CPU-side triangle mesh in world space, uploaded as-is (used for the knife). */
export interface WorldMesh {
  pos: Float32Array;
  normal: Float32Array;
  /** 4 floats per vertex; w selects steel (0) or handle (1). */
  rest: Float32Array;
  idx: Uint32Array;
}

export interface FrameOptions {
  variety: Variety;
  showMesh: boolean;
  knife: WorldMesh | null;
  time: number;
  /** Material to spotlight (-1 for none). */
  highlight: number;
  /** Bitmask of hidden materials. */
  hidden: number;
  /** Cell-type cytoplasm absorption for brightfield. */
  absorb?: Vec3;
  view: ViewMode;
}

interface GpuMesh {
  dyn: GPUBuffer;
  rest: GPUBuffer;
  idx: GPUBuffer;
  count: number;
  scratch: Float32Array;
  src: SkinMesh | WorldMesh;
}

interface GpuPiece {
  piece: Piece;
  uniform: GPUBuffer;
  group: GPUBindGroup;
  skin: GpuMesh;
  organelles: GpuMesh[];
  simPos: GPUBuffer;
  edges: GPUBuffer;
  edgeCount: number;
}

const DEPTH = 'depth32float';
const HDR = 'rgba16float';
const SHADOW_SIZE = 2048;
const FLOOR_SIZE = 512;
const FLOOR_EXTENT = 11;

export class Renderer {
  private format: GPUTextureFormat;
  private frameBuf: GPUBuffer;
  private cellBuf: GPUBuffer;
  private primBuf!: GPUBuffer;
  private primCount = 0;
  private camLight: GPUBuffer;
  private camFloor: GPUBuffer;
  private camMain: GPUBuffer;
  private linesBuf: GPUBuffer;
  private blitBuf: GPUBuffer;

  private bglFrame: GPUBindGroupLayout;
  private bglShadow: GPUBindGroupLayout;
  private bglPiece: GPUBindGroupLayout;
  private bglScreen: GPUBindGroupLayout;
  private bglCam: GPUBindGroupLayout;
  private bglBlit: GPUBindGroupLayout;

  private pDepthNoCull: GPURenderPipeline;
  private pDepthCullFront: GPURenderPipeline;
  private pFloor: GPURenderPipeline;
  private pOrganelle: GPURenderPipeline;
  private pBlade: GPURenderPipeline;
  private pJelly: GPURenderPipeline;
  private pBlit: GPURenderPipeline;
  private pLines: GPURenderPipeline;

  private shadowTex: GPUTexture;
  private floorTex: GPUTexture;
  private sceneColor!: GPUTexture;
  private accum!: GPUTexture;
  private sceneDepth!: GPUTexture;
  private backDepth!: GPUTexture;

  private gFrame!: GPUBindGroup;
  private gShadow: GPUBindGroup;
  private gScreen!: GPUBindGroup;
  private gBlit!: GPUBindGroup;
  private gCamLight: GPUBindGroup;
  private gCamFloor: GPUBindGroup;
  private gCamMain: GPUBindGroup;
  private gLines: GPUBindGroup;

  private pieces = new Map<Piece, GpuPiece>();
  private knife: GpuMesh | null = null;
  private width = 0;
  private height = 0;
  /** Latest matrices, for picking. */
  viewProj: M4 = new Float32Array(16);
  view: M4 = new Float32Array(16);

  static async create(canvas: HTMLCanvasElement): Promise<Renderer> {
    if (!navigator.gpu) throw new Error('WebGPU is not available in this browser.');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('No WebGPU adapter found.');
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    if (!context) throw new Error('Could not create a WebGPU canvas context.');
    return new Renderer(device, context, canvas);
  }

  private constructor(public device: GPUDevice, private context: GPUCanvasContext, private canvas: HTMLCanvasElement) {
    this.format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format: this.format, alphaMode: 'opaque' });
    const d = device;
    const U = GPUBufferUsage;
    this.frameBuf = d.createBuffer({ size: 688, usage: U.UNIFORM | U.COPY_DST });
    this.cellBuf = d.createBuffer({ size: 16, usage: U.UNIFORM | U.COPY_DST });
    this.camLight = d.createBuffer({ size: 64, usage: U.UNIFORM | U.COPY_DST });
    this.camFloor = d.createBuffer({ size: 64, usage: U.UNIFORM | U.COPY_DST });
    this.camMain = d.createBuffer({ size: 64, usage: U.UNIFORM | U.COPY_DST });
    this.linesBuf = d.createBuffer({ size: 80, usage: U.UNIFORM | U.COPY_DST });
    this.blitBuf = d.createBuffer({ size: 16, usage: U.UNIFORM | U.COPY_DST });

    const VF = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
    const FR = GPUShaderStage.FRAGMENT;
    this.bglFrame = d.createBindGroupLayout({ entries: [
      { binding: 0, visibility: VF, buffer: {} },
      { binding: 1, visibility: VF, buffer: {} },
      { binding: 2, visibility: FR, buffer: { type: 'read-only-storage' } },
    ] });
    this.bglShadow = d.createBindGroupLayout({ entries: [
      { binding: 0, visibility: FR, texture: { sampleType: 'depth' } },
      { binding: 1, visibility: FR, sampler: { type: 'comparison' } },
      { binding: 2, visibility: FR, texture: { sampleType: 'depth' } },
    ] });
    this.bglPiece = d.createBindGroupLayout({ entries: [{ binding: 0, visibility: VF, buffer: {} }] });
    this.bglScreen = d.createBindGroupLayout({ entries: [
      { binding: 0, visibility: FR, texture: { sampleType: 'float' } },
      { binding: 1, visibility: FR, sampler: { type: 'filtering' } },
      { binding: 2, visibility: FR, texture: { sampleType: 'depth' } },
      { binding: 3, visibility: FR, texture: { sampleType: 'depth' } },
    ] });
    this.bglCam = d.createBindGroupLayout({ entries: [{ binding: 0, visibility: VF, buffer: {} }] });
    this.bglBlit = d.createBindGroupLayout({ entries: [
      { binding: 0, visibility: FR, texture: { sampleType: 'unfilterable-float' } },
      { binding: 1, visibility: FR, buffer: {} },
    ] });

    const mod = (code: string) => d.createShaderModule({ code });
    const common = commonWgsl + '\n' + shadowWgsl + '\n';
    const skinBuffers: GPUVertexBufferLayout[] = [
      { arrayStride: 28, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }, { shaderLocation: 3, offset: 24, format: 'float32' }] },
      { arrayStride: 16, attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x4' }] },
    ];
    const posOnly: GPUVertexBufferLayout[] = [{ arrayStride: 28, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }];
    const layout = (...g: GPUBindGroupLayout[]) => d.createPipelineLayout({ bindGroupLayouts: g });

    const depthMod = mod(depthWgsl);
    const depthPipe = (cull: GPUCullMode) => d.createRenderPipeline({
      layout: layout(this.bglCam),
      vertex: { module: depthMod, entryPoint: 'vs', buffers: posOnly },
      primitive: { topology: 'triangle-list', cullMode: cull },
      depthStencil: { format: DEPTH, depthWriteEnabled: true, depthCompare: 'less' },
    });
    this.pDepthNoCull = depthPipe('none');
    this.pDepthCullFront = depthPipe('front');

    const hdrTarget: GPUColorTargetState[] = [{ format: HDR }];
    const opaqueDepth: GPUDepthStencilState = { format: DEPTH, depthWriteEnabled: true, depthCompare: 'less' };
    const floorMod = mod(common + floorWgsl);
    this.pFloor = d.createRenderPipeline({
      layout: layout(this.bglFrame, this.bglShadow),
      vertex: { module: floorMod, entryPoint: 'vs' },
      fragment: { module: floorMod, entryPoint: 'fs', targets: hdrTarget },
      primitive: { topology: 'triangle-strip' },
      depthStencil: opaqueDepth,
    });
    const orgMod = mod(common + organelleWgsl);
    this.pOrganelle = d.createRenderPipeline({
      layout: layout(this.bglFrame, this.bglShadow, this.bglPiece),
      vertex: { module: orgMod, entryPoint: 'vs', buffers: skinBuffers },
      fragment: { module: orgMod, entryPoint: 'fs', targets: hdrTarget },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: opaqueDepth,
    });
    const bladeMod = mod(common + bladeWgsl);
    this.pBlade = d.createRenderPipeline({
      layout: layout(this.bglFrame, this.bglShadow),
      vertex: { module: bladeMod, entryPoint: 'vs', buffers: skinBuffers },
      fragment: { module: bladeMod, entryPoint: 'fs', targets: hdrTarget },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: opaqueDepth,
    });
    const jellyMod = mod(common + jellyWgsl);
    this.pJelly = d.createRenderPipeline({
      layout: layout(this.bglFrame, this.bglShadow, this.bglPiece, this.bglScreen),
      vertex: { module: jellyMod, entryPoint: 'vs', buffers: skinBuffers },
      fragment: { module: jellyMod, entryPoint: 'fs', targets: hdrTarget },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { format: DEPTH, depthWriteEnabled: false, depthCompare: 'less' },
    });
    const blitMod = mod(blitWgsl);
    this.pBlit = d.createRenderPipeline({
      layout: layout(this.bglBlit),
      vertex: { module: blitMod, entryPoint: 'vs' },
      fragment: { module: blitMod, entryPoint: 'fs', targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list' },
    });
    const linesMod = mod(linesWgsl);
    this.pLines = d.createRenderPipeline({
      layout: layout(this.bglCam),
      vertex: { module: linesMod, entryPoint: 'vs', buffers: [{ arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }] },
      fragment: { module: linesMod, entryPoint: 'fs', targets: [{ format: this.format, blend: {
        color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
        alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
      } }] },
      primitive: { topology: 'line-list' },
    });

    this.shadowTex = d.createTexture({ size: [SHADOW_SIZE, SHADOW_SIZE], format: DEPTH, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    this.floorTex = d.createTexture({ size: [FLOOR_SIZE, FLOOR_SIZE], format: DEPTH, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    const cmp = d.createSampler({ compare: 'less', magFilter: 'linear', minFilter: 'linear' });
    this.gShadow = d.createBindGroup({ layout: this.bglShadow, entries: [
      { binding: 0, resource: this.shadowTex.createView() },
      { binding: 1, resource: cmp },
      { binding: 2, resource: this.floorTex.createView() },
    ] });
    const camGroup = (b: GPUBuffer) => d.createBindGroup({ layout: this.bglCam, entries: [{ binding: 0, resource: { buffer: b } }] });
    this.gCamLight = camGroup(this.camLight);
    this.gCamFloor = camGroup(this.camFloor);
    this.gCamMain = camGroup(this.camMain);
    this.gLines = camGroup(this.linesBuf);
  }

  setAnatomy(an: Anatomy) {
    this.device.queue.writeBuffer(this.cellBuf, 0, new Float32Array([an.wallThickness, an.body.length, 0, 0]));
    const prims = packAnatomyGPU(an);
    this.primBuf?.destroy();
    this.primBuf = this.device.createBuffer({ size: prims.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(this.primBuf, 0, prims);
    this.primCount = an.organelles.length;
    this.gFrame = this.device.createBindGroup({ layout: this.bglFrame, entries: [
      { binding: 0, resource: { buffer: this.frameBuf } },
      { binding: 1, resource: { buffer: this.cellBuf } },
      { binding: 2, resource: { buffer: this.primBuf } },
    ] });
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (w === this.width && h === this.height) return;
    this.width = w; this.height = h;
    this.canvas.width = w; this.canvas.height = h;
    for (const t of [this.sceneColor, this.accum, this.sceneDepth, this.backDepth]) t?.destroy();
    const d = this.device, T = GPUTextureUsage;
    this.sceneColor = d.createTexture({ size: [w, h], format: HDR, usage: T.RENDER_ATTACHMENT | T.TEXTURE_BINDING | T.COPY_SRC | T.COPY_DST });
    this.accum = d.createTexture({ size: [w, h], format: HDR, usage: T.RENDER_ATTACHMENT | T.TEXTURE_BINDING | T.COPY_SRC | T.COPY_DST });
    this.sceneDepth = d.createTexture({ size: [w, h], format: DEPTH, usage: T.RENDER_ATTACHMENT | T.TEXTURE_BINDING });
    this.backDepth = d.createTexture({ size: [w, h], format: DEPTH, usage: T.RENDER_ATTACHMENT | T.TEXTURE_BINDING });
    const lin = d.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
    this.gScreen = d.createBindGroup({ layout: this.bglScreen, entries: [
      { binding: 0, resource: this.sceneColor.createView() },
      { binding: 1, resource: lin },
      { binding: 2, resource: this.sceneDepth.createView() },
      { binding: 3, resource: this.backDepth.createView() },
    ] });
    this.gBlit = d.createBindGroup({ layout: this.bglBlit, entries: [
      { binding: 0, resource: this.accum.createView() },
      { binding: 1, resource: { buffer: this.blitBuf } },
    ] });
  }

  private makeMesh(src: SkinMesh | WorldMesh, restW: (v: number) => number): GpuMesh {
    const d = this.device, n = src.pos.length / 3;
    const dyn = d.createBuffer({ size: Math.max(28, n * 28), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    const restData = new Float32Array(n * 4);
    if ('tetId' in src) {
      for (let v = 0; v < n; v++) { restData.set(src.restPos.subarray(3 * v, 3 * v + 3), 4 * v); restData[4 * v + 3] = restW(v); }
    } else restData.set(src.rest);
    const rest = d.createBuffer({ size: Math.max(16, restData.byteLength), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    d.queue.writeBuffer(rest, 0, restData);
    const idx = d.createBuffer({ size: Math.max(4, src.idx.byteLength), usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
    d.queue.writeBuffer(idx, 0, src.idx);
    const m: GpuMesh = { dyn, rest, idx, count: src.idx.length, scratch: new Float32Array(n * 7), src };
    this.uploadMesh(m);
    return m;
  }

  private uploadMesh(m: GpuMesh) {
    const { pos, normal } = m.src, s = m.scratch;
    const scalar = 'scalar' in m.src ? m.src.scalar : undefined;
    for (let v = 0, n = pos.length / 3; v < n; v++) {
      s[7 * v] = pos[3 * v]; s[7 * v + 1] = pos[3 * v + 1]; s[7 * v + 2] = pos[3 * v + 2];
      s[7 * v + 3] = normal[3 * v]; s[7 * v + 4] = normal[3 * v + 1]; s[7 * v + 5] = normal[3 * v + 2];
      s[7 * v + 6] = scalar ? scalar[v] : 0;
    }
    this.device.queue.writeBuffer(m.dyn, 0, s);
  }

  private destroyMesh(m: GpuMesh) { m.dyn.destroy(); m.rest.destroy(); m.idx.destroy(); }

  /** Creates GPU state for new pieces, frees removed ones and uploads current positions. */
  syncPieces(pieces: Piece[], showMesh: boolean) {
    const live = new Set(pieces);
    for (const [p, g] of this.pieces) {
      if (live.has(p)) continue;
      this.destroyMesh(g.skin); g.organelles.forEach((o) => this.destroyMesh(o));
      g.uniform.destroy(); g.simPos.destroy(); g.edges.destroy();
      this.pieces.delete(p);
    }
    for (const p of pieces) {
      let g = this.pieces.get(p);
      if (!g) {
        const d = this.device;
        const uniform = d.createBuffer({ size: 144, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        const u = new Float32Array(36);
        p.planes.slice(0, 8).forEach((pl, i) => { u.set(pl.n, 4 * i); u[4 * i + 3] = pl.d; });
        u[32] = Math.min(8, p.planes.length);
        d.queue.writeBuffer(uniform, 0, u);
        const simPos = d.createBuffer({ size: p.sim.pos.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
        const edges = d.createBuffer({ size: p.sim.edges.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
        d.queue.writeBuffer(edges, 0, p.sim.edges);
        g = {
          piece: p, uniform,
          group: d.createBindGroup({ layout: this.bglPiece, entries: [{ binding: 0, resource: { buffer: uniform } }] }),
          skin: this.makeMesh(p.skin, (v) => p.skin.isCutFace[v]),
          organelles: p.organelles.map((o) => this.makeMesh(o, () => o.material)),
          simPos, edges, edgeCount: p.sim.edges.length,
        };
        this.pieces.set(p, g);
      } else {
        this.uploadMesh(g.skin);
        g.organelles.forEach((o) => this.uploadMesh(o));
      }
      if (showMesh) this.device.queue.writeBuffer(g.simPos, 0, p.sim.pos);
    }
  }

  private syncKnife(k: WorldMesh | null) {
    if (!k) return;
    if (!this.knife || this.knife.src.pos.length !== k.pos.length) {
      if (this.knife) this.destroyMesh(this.knife);
      this.knife = this.makeMesh(k, () => 0);
    } else {
      this.knife.src = k;
      this.uploadMesh(this.knife);
    }
  }

  get aspect() { this.resize(); return this.width / this.height; }

  cameraMatrices(cam: Camera) {
    this.resize();
    const aspect = this.width / this.height;
    const near = 0.5, far = 200;
    const proj = perspective(cam.fovY, aspect, near, far);
    proj[9] = -2 * (cam.lensShiftY ?? 0);
    const view = lookAt(cam.eye, cam.target, [0, 1, 0]);
    return { proj, view, viewProj: mul(proj, view), near, far };
  }

  render(pieces: Piece[], cam: Camera, opt: FrameOptions) {
    const { proj, view, viewProj } = this.cameraMatrices(cam);
    this.view = view; this.viewProj = viewProj;
    const d = this.device, q = d.queue;
    this.syncPieces(pieces, opt.showMesh);
    this.syncKnife(opt.knife);

    // Lights: an orthographic key light and a bottom-up floor camera, both centred on the target.
    const L = normalize([-0.42, 1, 0.38]);
    const t = cam.target;
    const lightView = lookAt([t[0] + L[0] * 30, t[1] + L[1] * 30, t[2] + L[2] * 30], t, [0, 0, -1]);
    const lightVP = mul(ortho(-11, 11, -11, 11, 1, 60), lightView);
    const floorView = lookAt([t[0], -0.5, t[2]], [t[0], 10, t[2]], [0, 0, -1]);
    const floorVP = mul(ortho(-FLOOR_EXTENT, FLOOR_EXTENT, -FLOOR_EXTENT, FLOOR_EXTENT, 0, 20), floorView);

    const f = new Float32Array(172);
    f.set(viewProj, 0); f.set(view, 16); f.set(lightVP, 32); f.set(floorVP, 48);
    f.set([...cam.eye, 1], 64);
    f.set([...L, 0], 68);
    f.set([this.width, this.height, 1 / this.width, 1 / this.height], 72);
    f.set([proj[10], proj[14], 0.5, 200], 76);
    f.set([opt.time, this.primCount, opt.highlight, opt.hidden], 80);
    f.set(packPalette(opt.variety, opt.absorb), 84);
    f[84 + 4 * 4 + 3] = opt.view === 'deformation' ? 1 : 0;
    q.writeBuffer(this.frameBuf, 0, f);
    q.writeBuffer(this.camLight, 0, lightVP);
    q.writeBuffer(this.camFloor, 0, floorVP);
    q.writeBuffer(this.camMain, 0, viewProj);
    const bg = f.subarray(84 + 8, 84 + 11);
    q.writeBuffer(this.blitBuf, 0, new Float32Array([bg[0], bg[1], bg[2], opt.variety.emissive ? 0.25 : 0.06]));

    const gps = pieces.map((p) => this.pieces.get(p)!);
    const enc = d.createCommandEncoder();
    const drawDepth = (pass: GPURenderPassEncoder, m: GpuMesh) => {
      pass.setVertexBuffer(0, m.dyn);
      pass.setIndexBuffer(m.idx, 'uint32');
      pass.drawIndexed(m.count);
    };
    const drawSkin = (pass: GPURenderPassEncoder, m: GpuMesh) => {
      pass.setVertexBuffer(0, m.dyn);
      pass.setVertexBuffer(1, m.rest);
      pass.setIndexBuffer(m.idx, 'uint32');
      pass.drawIndexed(m.count);
    };
    const depthOnly = (tex: GPUTexture, pipe: GPURenderPipeline, group: GPUBindGroup, meshes: GpuMesh[]) => {
      const pass = enc.beginRenderPass({ colorAttachments: [], depthStencilAttachment: { view: tex.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } });
      pass.setPipeline(pipe);
      pass.setBindGroup(0, group);
      meshes.forEach((m) => drawDepth(pass, m));
      pass.end();
    };

    const casters = gps.map((g) => g.skin);
    if (opt.knife && this.knife) casters.push(this.knife);
    depthOnly(this.shadowTex, this.pDepthNoCull, this.gCamLight, casters);
    depthOnly(this.floorTex, this.pDepthNoCull, this.gCamFloor, gps.map((g) => g.skin));

    // Opaque scene.
    {
      const pass = enc.beginRenderPass({
        colorAttachments: [{ view: this.sceneColor.createView(), clearValue: { r: bg[0], g: bg[1], b: bg[2], a: 1 }, loadOp: 'clear', storeOp: 'store' }],
        depthStencilAttachment: { view: this.sceneDepth.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' },
      });
      pass.setBindGroup(0, this.gFrame);
      pass.setBindGroup(1, this.gShadow);
      pass.setPipeline(this.pFloor);
      pass.draw(4);
      pass.setPipeline(this.pOrganelle);
      for (const g of gps) {
        pass.setBindGroup(2, g.group);
        g.organelles.forEach((o) => drawSkin(pass, o));
      }
      if (opt.knife && this.knife) {
        pass.setPipeline(this.pBlade);
        drawSkin(pass, this.knife);
      }
      pass.end();
    }
    enc.copyTextureToTexture({ texture: this.sceneColor }, { texture: this.accum }, [this.width, this.height]);

    // Jelly, back to front; each piece refracts everything drawn before it.
    const eye = cam.eye;
    const order = gps
      .map((g) => ({ g, d: dist2(centroid(g.piece.sim.pos), eye) }))
      .sort((a, b) => b.d - a.d)
      .map((o) => o.g);
    order.forEach((g, i) => {
      depthOnly(this.backDepth, this.pDepthCullFront, this.gCamMain, [g.skin]);
      const pass = enc.beginRenderPass({
        colorAttachments: [{ view: this.accum.createView(), loadOp: 'load', storeOp: 'store' }],
        depthStencilAttachment: { view: this.sceneDepth.createView(), depthReadOnly: true },
      });
      pass.setPipeline(this.pJelly);
      pass.setBindGroup(0, this.gFrame);
      pass.setBindGroup(1, this.gShadow);
      pass.setBindGroup(2, g.group);
      pass.setBindGroup(3, this.gScreen);
      drawSkin(pass, g.skin);
      pass.end();
      if (i < order.length - 1) enc.copyTextureToTexture({ texture: this.accum }, { texture: this.sceneColor }, [this.width, this.height]);
    });

    // Composite.
    {
      const pass = enc.beginRenderPass({ colorAttachments: [{ view: this.context.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
      pass.setPipeline(this.pBlit);
      pass.setBindGroup(0, this.gBlit);
      pass.draw(3);
      if (opt.showMesh) {
        const lc = opt.variety.emissive ? [0.85, 0.9, 1, 0.28] : [0.08, 0.07, 0.06, 0.32];
        q.writeBuffer(this.linesBuf, 0, new Float32Array([...viewProj, ...lc]));
        pass.setPipeline(this.pLines);
        pass.setBindGroup(0, this.gLines);
        for (const g of gps) {
          pass.setVertexBuffer(0, g.simPos);
          pass.setIndexBuffer(g.edges, 'uint32');
          pass.drawIndexed(g.edgeCount);
        }
      }
      pass.end();
    }
    q.submit([enc.finish()]);
  }
}

function normalize(v: number[]) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
function centroid(p: Float32Array) {
  const c = [0, 0, 0];
  for (let i = 0; i < p.length; i += 3) { c[0] += p[i]; c[1] += p[i + 1]; c[2] += p[i + 2]; }
  const n = p.length / 3;
  return [c[0] / n, c[1] / n, c[2] / n];
}
function dist2(a: number[], b: number[]) { return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2; }
