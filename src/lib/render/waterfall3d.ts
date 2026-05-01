import createREGL, { type Regl, type DrawCommand, type DefaultContext, type Texture2D, type Buffer, type Elements } from 'regl';
import { buildLut } from '$lib/colormap';

export interface Waterfall3DRenderer {
  resize(width: number, height: number): void;
  setGrid(amps: Float32Array, gridWidth: number, gridHeight: number): void;
  setColormapLut(lut: Uint8Array): void;
  setRotation(yaw: number, pitch: number): void;
  setHeightScale(scale: number): void;
  setDistance(d: number): void;
  setPan(x: number, y: number): void;
  setAxisLines(positions: Float32Array): void;
  setGridLines(positions: Float32Array): void;
  project(x: number, y: number, z: number): [number, number] | null;
  getViewport(): { width: number; height: number };
  draw(): void;
  destroy(): void;
}

type Mat4 = Float32Array;

function mat4Identity(): Mat4 {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

function mat4Perspective(out: Mat4, fovY: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1.0 / Math.tan(fovY / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

function mat4LookAt(out: Mat4, eye: [number, number, number], target: [number, number, number], up: [number, number, number]): Mat4 {
  const [ex, ey, ez] = eye;
  const [tx, ty, tz] = target;
  const [ux, uy, uz] = up;
  let zx = ex - tx, zy = ey - ty, zz = ez - tz;
  const zl = Math.hypot(zx, zy, zz);
  zx /= zl; zy /= zl; zz /= zl;
  let xx = uy * zz - uz * zy;
  let xy = uz * zx - ux * zz;
  let xz = ux * zy - uy * zx;
  const xl = Math.hypot(xx, xy, xz);
  xx /= xl; xy /= xl; xz /= xl;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  out[0] = xx; out[4] = xy; out[8] = xz; out[12] = -(xx * ex + xy * ey + xz * ez);
  out[1] = yx; out[5] = yy; out[9] = yz; out[13] = -(yx * ex + yy * ey + yz * ez);
  out[2] = zx; out[6] = zy; out[10] = zz; out[14] = -(zx * ex + zy * ey + zz * ez);
  out[3] = 0; out[7] = 0; out[11] = 0; out[15] = 1;
  return out;
}

function mat4Multiply(out: Mat4, a: Mat4, b: Mat4): Mat4 {
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      out[i * 4 + j] =
        a[0 * 4 + j] * b[i * 4 + 0] +
        a[1 * 4 + j] * b[i * 4 + 1] +
        a[2 * 4 + j] * b[i * 4 + 2] +
        a[3 * 4 + j] * b[i * 4 + 3];
    }
  }
  return out;
}

interface DrawProps {
  mvp: Mat4;
  cmap: Texture2D;
  heightScale: number;
  grid: Buffer;
  amp: Buffer;
  elements: Elements;
  count: number;
}

interface AxisDrawProps {
  mvp: Mat4;
  positions: Buffer;
  count: number;
  color: [number, number, number];
}

const VERT = `
precision mediump float;
attribute vec2 a_grid;
attribute float a_amp;
uniform mat4 u_mvp;
uniform float u_height_scale;
varying float v_amp;
void main() {
  v_amp = a_amp;
  float x = a_grid.x * 2.0 - 1.0;
  float z = a_grid.y * 2.0 - 1.0;
  float y = a_amp * u_height_scale;
  gl_Position = u_mvp * vec4(x, y, z, 1.0);
}`;

const FRAG = `
precision mediump float;
uniform sampler2D u_cmap;
varying float v_amp;
void main() {
  vec3 color = texture2D(u_cmap, vec2(v_amp, 0.5)).rgb;
  gl_FragColor = vec4(color, 1.0);
}`;

const AXIS_VERT = `
precision mediump float;
attribute vec3 a_pos;
uniform mat4 u_mvp;
void main() {
  gl_Position = u_mvp * vec4(a_pos, 1.0);
}`;

const AXIS_FRAG = `
precision mediump float;
uniform vec3 u_color;
void main() {
  gl_FragColor = vec4(u_color, 1.0);
}`;

export function createWaterfall3DRenderer(canvas: HTMLCanvasElement): Waterfall3DRenderer {
  const regl: Regl = createREGL({
    canvas,
    extensions: ['oes_element_index_uint'],
    attributes: { antialias: true, preserveDrawingBuffer: true }
  });

  let cmap = regl.texture({
    data: buildLut('viridis'),
    width: 256,
    height: 1,
    format: 'rgba',
    mag: 'linear',
    min: 'linear',
    wrapS: 'clamp',
    wrapT: 'clamp'
  });

  let gridBuffer: Buffer | null = null;
  let ampBuffer: Buffer | null = null;
  let indexBuffer: Elements | null = null;
  let indexCount = 0;
  let gridW = 0;
  let gridH = 0;

  let axisBuffer: Buffer | null = null;
  let axisCount = 0;
  let gridBufferLines: Buffer | null = null;
  let gridLinesCount = 0;

  let yaw = 0.5;
  let pitch = -0.4;
  let heightScale = 0.6;
  let camDistance = 3.2;
  let panX = 0;
  let panY = 0;
  let viewportW = 1;
  let viewportH = 1;
  // Pre-allocated matrices, mutated in buildMvp() to avoid per-frame Float32 allocation.
  const projMat: Mat4 = new Float32Array(16);
  const viewMat: Mat4 = new Float32Array(16);
  const currentMvp: Mat4 = mat4Identity();

  const draw: DrawCommand<DefaultContext, DrawProps> = regl({
    vert: VERT,
    frag: FRAG,
    attributes: {
      a_grid: regl.prop<DrawProps, 'grid'>('grid'),
      a_amp: regl.prop<DrawProps, 'amp'>('amp')
    },
    uniforms: {
      u_mvp: regl.prop<DrawProps, 'mvp'>('mvp'),
      u_cmap: regl.prop<DrawProps, 'cmap'>('cmap'),
      u_height_scale: regl.prop<DrawProps, 'heightScale'>('heightScale')
    },
    elements: regl.prop<DrawProps, 'elements'>('elements'),
    count: regl.prop<DrawProps, 'count'>('count'),
    depth: { enable: true, func: 'less' },
    cull: { enable: false }
  });

  const drawAxes: DrawCommand<DefaultContext, AxisDrawProps> = regl({
    vert: AXIS_VERT,
    frag: AXIS_FRAG,
    attributes: {
      a_pos: regl.prop<AxisDrawProps, 'positions'>('positions')
    },
    uniforms: {
      u_mvp: regl.prop<AxisDrawProps, 'mvp'>('mvp'),
      u_color: regl.prop<AxisDrawProps, 'color'>('color')
    },
    count: regl.prop<AxisDrawProps, 'count'>('count'),
    primitive: 'lines',
    depth: { enable: true, func: 'lequal' }
  });

  function rebuildGrid(w: number, h: number) {
    const positions = new Float32Array(w * h * 2);
    let p = 0;
    for (let j = 0; j < h; j++) {
      const v = j / (h - 1);
      for (let i = 0; i < w; i++) {
        positions[p++] = i / (w - 1);
        positions[p++] = v;
      }
    }
    if (gridBuffer) gridBuffer.destroy();
    gridBuffer = regl.buffer({ data: positions, usage: 'static' });

    const quads = (w - 1) * (h - 1);
    const indices = new Uint32Array(quads * 6);
    let q = 0;
    for (let j = 0; j < h - 1; j++) {
      for (let i = 0; i < w - 1; i++) {
        const a = j * w + i;
        const b = a + 1;
        const c = a + w;
        const d = c + 1;
        indices[q++] = a;
        indices[q++] = b;
        indices[q++] = c;
        indices[q++] = b;
        indices[q++] = d;
        indices[q++] = c;
      }
    }
    if (indexBuffer) indexBuffer.destroy();
    indexBuffer = regl.elements({
      data: indices,
      primitive: 'triangles',
      type: 'uint32'
    });
    indexCount = indices.length;
    gridW = w;
    gridH = h;
  }

  const eyeVec: [number, number, number] = [0, 0, 0];
  const targetVec: [number, number, number] = [0, 0, 0];
  const upVec: [number, number, number] = [0, 1, 0];

  function buildMvp(out: Mat4): Mat4 {
    const aspect = Math.max(0.01, viewportW / viewportH);
    mat4Perspective(projMat, Math.PI / 4, aspect, 0.1, 100);
    eyeVec[0] = Math.sin(yaw) * Math.cos(pitch) * camDistance + panX;
    eyeVec[1] = Math.sin(-pitch) * camDistance + 0.2 + panY;
    eyeVec[2] = Math.cos(yaw) * Math.cos(pitch) * camDistance;
    targetVec[0] = panX;
    targetVec[1] = panY;
    targetVec[2] = 0;
    mat4LookAt(viewMat, eyeVec, targetVec, upVec);
    return mat4Multiply(out, projMat, viewMat);
  }

  return {
    resize(width, height) {
      canvas.width = width;
      canvas.height = height;
      viewportW = width;
      viewportH = height;
      regl.poll();
    },
    setGrid(amps, w, h) {
      if (w !== gridW || h !== gridH) rebuildGrid(w, h);
      if (!ampBuffer) ampBuffer = regl.buffer({ data: amps, usage: 'dynamic' });
      else ampBuffer(amps);
    },
    setColormapLut(lut) {
      cmap.subimage(lut);
    },
    setRotation(y, p) {
      yaw = y;
      pitch = p;
    },
    setHeightScale(s) {
      heightScale = s;
    },
    setDistance(d) {
      camDistance = Math.max(1.2, Math.min(12, d));
    },
    setPan(x, y) {
      panX = x;
      panY = y;
    },
    setAxisLines(positions) {
      if (!axisBuffer) axisBuffer = regl.buffer({ data: positions, usage: 'dynamic' });
      else axisBuffer(positions);
      axisCount = positions.length / 3;
    },
    setGridLines(positions) {
      if (!gridBufferLines) gridBufferLines = regl.buffer({ data: positions, usage: 'dynamic' });
      else gridBufferLines(positions);
      gridLinesCount = positions.length / 3;
    },
    project(x, y, z) {
      const m = currentMvp;
      const clipX = m[0] * x + m[4] * y + m[8] * z + m[12];
      const clipY = m[1] * x + m[5] * y + m[9] * z + m[13];
      const clipW = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (clipW <= 0) return null;
      const ndcX = clipX / clipW;
      const ndcY = clipY / clipW;
      return [(ndcX + 1) * 0.5, (1 - ndcY) * 0.5];
    },
    getViewport() {
      return { width: viewportW, height: viewportH };
    },
    draw() {
      regl.clear({ color: [0, 0, 0, 1], depth: 1 });
      if (!gridBuffer || !ampBuffer || !indexBuffer) return;
      buildMvp(currentMvp);
      draw({
        mvp: currentMvp,
        cmap,
        heightScale,
        grid: gridBuffer,
        amp: ampBuffer,
        elements: indexBuffer,
        count: indexCount
      });
      if (gridBufferLines && gridLinesCount > 0) {
        drawAxes({
          mvp: currentMvp,
          positions: gridBufferLines,
          count: gridLinesCount,
          color: [0.22, 0.25, 0.35]
        });
      }
      if (axisBuffer && axisCount > 0) {
        drawAxes({
          mvp: currentMvp,
          positions: axisBuffer,
          count: axisCount,
          color: [0.55, 0.58, 0.7]
        });
      }
    },
    destroy() {
      if (gridBuffer) gridBuffer.destroy();
      if (ampBuffer) ampBuffer.destroy();
      if (indexBuffer) indexBuffer.destroy();
      if (axisBuffer) axisBuffer.destroy();
      if (gridBufferLines) gridBufferLines.destroy();
      cmap.destroy();
      regl.destroy();
    }
  };
}
