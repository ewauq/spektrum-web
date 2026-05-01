export type WindowType = 'hann' | 'hamming' | 'blackman' | 'blackman-harris' | 'rectangular';

export function hann(size: number): Float32Array {
  const w = new Float32Array(size);
  const factor = (2 * Math.PI) / (size - 1);
  for (let i = 0; i < size; i++) {
    w[i] = 0.5 * (1 - Math.cos(factor * i));
  }
  return w;
}

export function hamming(size: number): Float32Array {
  const w = new Float32Array(size);
  const factor = (2 * Math.PI) / (size - 1);
  for (let i = 0; i < size; i++) {
    w[i] = 0.54 - 0.46 * Math.cos(factor * i);
  }
  return w;
}

export function blackman(size: number): Float32Array {
  const w = new Float32Array(size);
  const a0 = 0.42;
  const a1 = 0.5;
  const a2 = 0.08;
  const factor = (2 * Math.PI) / (size - 1);
  for (let i = 0; i < size; i++) {
    const t = factor * i;
    w[i] = a0 - a1 * Math.cos(t) + a2 * Math.cos(2 * t);
  }
  return w;
}

export function blackmanHarris(size: number): Float32Array {
  const w = new Float32Array(size);
  const a0 = 0.35875;
  const a1 = 0.48829;
  const a2 = 0.14128;
  const a3 = 0.01168;
  const factor = (2 * Math.PI) / (size - 1);
  for (let i = 0; i < size; i++) {
    const t = factor * i;
    w[i] = a0 - a1 * Math.cos(t) + a2 * Math.cos(2 * t) - a3 * Math.cos(3 * t);
  }
  return w;
}

export function rectangular(size: number): Float32Array {
  const w = new Float32Array(size);
  w.fill(1);
  return w;
}

export function getWindow(type: WindowType, size: number): Float32Array {
  switch (type) {
    case 'hann':
      return hann(size);
    case 'hamming':
      return hamming(size);
    case 'blackman':
      return blackman(size);
    case 'blackman-harris':
      return blackmanHarris(size);
    case 'rectangular':
      return rectangular(size);
  }
}
