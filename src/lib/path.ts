/**
 * File path helpers tolerant to both POSIX (/) and Windows (\) separators.
 * Centralizing avoids reimplementing the same split-and-pop dance in
 * multiple components and keeps the regex consistent.
 */

const SEP_RE = /[\\/]/;

export function fileName(path: string): string {
  return path.split(SEP_RE).pop() ?? path;
}

export function dirName(path: string): string {
  const parts = path.split(SEP_RE);
  parts.pop();
  return parts.join('\\') || path;
}

export function baseName(path: string): string {
  const name = fileName(path);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}
