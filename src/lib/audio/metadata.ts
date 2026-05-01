export interface FlacMetadata {
  vendorString: string;
}

export function parseFlacMetadata(bytes: Uint8Array): FlacMetadata | null {
  if (bytes.length < 8) return null;
  if (bytes[0] !== 0x66 || bytes[1] !== 0x4c || bytes[2] !== 0x61 || bytes[3] !== 0x43) return null;

  let offset = 4;
  while (offset < bytes.length) {
    const header = bytes[offset];
    const isLast = (header & 0x80) !== 0;
    const blockType = header & 0x7f;
    const blockLen = (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    offset += 4;

    if (blockType === 4) {
      const view = new DataView(bytes.buffer, bytes.byteOffset + offset, blockLen);
      const vendorLen = view.getUint32(0, true);
      const vendorString = new TextDecoder().decode(bytes.subarray(offset + 4, offset + 4 + vendorLen));
      return { vendorString };
    }

    offset += blockLen;
    if (isLast) break;
  }

  return null;
}
