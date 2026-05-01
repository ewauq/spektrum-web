const registry = new Map<string, Blob>();

export function registerFile(file: File): string {
  if (!registry.has(file.name)) {
    registry.set(file.name, file);
    return file.name;
  }
  const dot = file.name.lastIndexOf('.');
  const base = dot === -1 ? file.name : file.name.slice(0, dot);
  const ext = dot === -1 ? '' : file.name.slice(dot);
  let i = 2;
  let candidate = `${base} (${i})${ext}`;
  while (registry.has(candidate)) {
    i++;
    candidate = `${base} (${i})${ext}`;
  }
  registry.set(candidate, file);
  return candidate;
}

export function getFile(handle: string): Blob | null {
  return registry.get(handle) ?? null;
}

export function dropFile(handle: string): void {
  registry.delete(handle);
}
