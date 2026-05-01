/**
 * Trigger a browser download for the given Blob using a transient
 * `<a download>` element. The user picks the destination via the
 * standard browser save dialog (or the file lands in the configured
 * Downloads folder, depending on browser settings).
 */
export function saveBlob(blob: Blob, suggestedName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Defer cleanup so the browser starts the download before we revoke.
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 100);
}
