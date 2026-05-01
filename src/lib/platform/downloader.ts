export function saveBlob(blob: Blob, suggestedName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Defer revoke so the browser fully starts the download first.
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 100);
}
