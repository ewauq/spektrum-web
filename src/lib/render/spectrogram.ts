import createREGL, { type Regl, type DefaultContext, type DrawCommand, type Texture2D } from 'regl';
import { buildLut } from '$lib/colormap';

export interface SpectrogramRenderer {
  resize(width: number, height: number): void;
  uploadSpectrum(data: Uint8Array, width: number, height: number): void;
  setDbRange(floor: number, ceiling: number, dataFloor: number, dataCeiling: number): void;
  setColormapLut(lut: Uint8Array): void;
  setSmoothing(linear: boolean): void;
  draw(): void;
  destroy(): void;
}

interface DrawProps {
  spec: Texture2D;
  cmap: Texture2D;
  dbFloor: number;
  dbCeiling: number;
  dataFloor: number;
  dataCeiling: number;
}

const VERT = `
precision mediump float;
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
uniform sampler2D u_spec;
uniform sampler2D u_cmap;
uniform float u_db_floor;
uniform float u_db_ceiling;
uniform float u_data_floor;
uniform float u_data_ceiling;
varying vec2 v_uv;
void main() {
  float r = texture2D(u_spec, v_uv).r;
  float db = u_data_floor + r * (u_data_ceiling - u_data_floor);
  float v = clamp((db - u_db_floor) / max(u_db_ceiling - u_db_floor, 0.001), 0.0, 1.0);
  gl_FragColor = texture2D(u_cmap, vec2(v, 0.5));
}`;

export function createSpectrogramRenderer(canvas: HTMLCanvasElement): SpectrogramRenderer {
  const regl: Regl = createREGL({
    canvas,
    attributes: { antialias: false, preserveDrawingBuffer: true }
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

  let spec: Texture2D | null = null;
  let specW = 0;
  let specH = 0;
  let specFilter: 'linear' | 'nearest' = 'linear';

  let dbFloor = -140;
  let dbCeiling = 0;
  let dataFloor = -140;
  let dataCeiling = 0;

  const draw: DrawCommand<DefaultContext, DrawProps> = regl({
    vert: VERT,
    frag: FRAG,
    attributes: {
      a_pos: [-1, -1, 1, -1, -1, 1, 1, 1]
    },
    uniforms: {
      u_spec: regl.prop<DrawProps, 'spec'>('spec'),
      u_cmap: regl.prop<DrawProps, 'cmap'>('cmap'),
      u_db_floor: regl.prop<DrawProps, 'dbFloor'>('dbFloor'),
      u_db_ceiling: regl.prop<DrawProps, 'dbCeiling'>('dbCeiling'),
      u_data_floor: regl.prop<DrawProps, 'dataFloor'>('dataFloor'),
      u_data_ceiling: regl.prop<DrawProps, 'dataCeiling'>('dataCeiling')
    },
    count: 4,
    primitive: 'triangle strip',
    depth: { enable: false }
  });

  function slice(data: Uint8Array, width: number, height: number): Uint8Array {
    const needed = width * height;
    return data.length === needed ? data : data.subarray(0, needed);
  }

  function makeSpecTexture(data: Uint8Array, width: number, height: number) {
    return regl.texture({
      data: slice(data, width, height),
      width,
      height,
      format: 'luminance',
      type: 'uint8',
      mag: specFilter,
      min: specFilter,
      wrapS: 'clamp',
      wrapT: 'clamp'
    });
  }

  return {
    resize(width, height) {
      canvas.width = width;
      canvas.height = height;
      regl.poll();
    },
    uploadSpectrum(data, width, height) {
      if (!spec || specW !== width || specH !== height) {
        if (spec) spec.destroy();
        spec = makeSpecTexture(data, width, height);
        specW = width;
        specH = height;
      } else {
        spec.subimage(slice(data, width, height));
      }
    },
    setDbRange(floor, ceiling, df, dc) {
      dbFloor = floor;
      dbCeiling = ceiling;
      dataFloor = df;
      dataCeiling = dc;
    },
    setColormapLut(lut) {
      cmap.subimage(lut);
    },
    setSmoothing(linear) {
      const next: 'linear' | 'nearest' = linear ? 'linear' : 'nearest';
      if (next === specFilter) return;
      specFilter = next;
      if (spec) {
        spec.destroy();
        specW = 0;
        specH = 0;
        spec = null;
      }
    },
    draw() {
      regl.clear({ color: [0, 0, 0, 1], depth: 1 });
      if (spec) {
        draw({ spec, cmap, dbFloor, dbCeiling, dataFloor, dataCeiling });
      }
    },
    destroy() {
      if (spec) spec.destroy();
      cmap.destroy();
      regl.destroy();
    }
  };
}
