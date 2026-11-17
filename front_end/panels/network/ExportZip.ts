// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

export interface ZipEntry {
  path: string;
  data: Uint8Array;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): {time: number, date: number} {
  const time =
      ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f);
  const day = (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0xf) << 5) |
      (date.getDate() & 0x1f);
  return {time, date: day};
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').split('/').filter(part => part && part !== '.' && part !== '..').join('/');
}

/**
 * Builds a store-method ZIP. Responses are already compressed, and storing keeps
 * the browser-side implementation small and dependency-free.
 */
export function createZip(entries: ZipEntry[], now: Date = new Date()): Uint8Array {
  const encoder = new TextEncoder();
  const {time, date} = dosDateTime(now);
  const used = new Set<string>();
  const prepared: Array<{name: Uint8Array, data: Uint8Array, crc: number, offset: number}> = [];

  let size = 22;
  for (const entry of entries) {
    let path = normalizePath(entry.path);
    if (!path) {
      continue;
    }
    if (used.has(path)) {
      const dot = path.lastIndexOf('.');
      const stem = dot > 0 ? path.slice(0, dot) : path;
      const extension = dot > 0 ? path.slice(dot) : '';
      let counter = 2;
      while (used.has(`${stem}-${counter}${extension}`)) {
        counter++;
      }
      path = `${stem}-${counter}${extension}`;
    }
    used.add(path);
    const name = encoder.encode(path);
    size += 30 + name.length + entry.data.length + 46 + name.length;
    prepared.push({name, data: entry.data, crc: crc32(entry.data), offset: 0});
  }

  const output = new Uint8Array(size);
  const view = new DataView(output.buffer);
  let offset = 0;

  const u16 = (value: number): void => {
    view.setUint16(offset, value, true);
    offset += 2;
  };
  const u32 = (value: number): void => {
    view.setUint32(offset, value >>> 0, true);
    offset += 4;
  };
  const bytes = (value: Uint8Array): void => {
    output.set(value, offset);
    offset += value.length;
  };

  for (const entry of prepared) {
    entry.offset = offset;
    u32(0x04034b50);
    u16(20);
    u16(0x0800);
    u16(0);
    u16(time);
    u16(date);
    u32(entry.crc);
    u32(entry.data.length);
    u32(entry.data.length);
    u16(entry.name.length);
    u16(0);
    bytes(entry.name);
    bytes(entry.data);
  }

  const centralStart = offset;
  for (const entry of prepared) {
    u32(0x02014b50);
    u16(20);
    u16(20);
    u16(0x0800);
    u16(0);
    u16(time);
    u16(date);
    u32(entry.crc);
    u32(entry.data.length);
    u32(entry.data.length);
    u16(entry.name.length);
    u16(0);
    u16(0);
    u16(0);
    u16(0);
    u32(0);
    u32(entry.offset);
    bytes(entry.name);
  }

  u32(0x06054b50);
  u16(0);
  u16(0);
  u16(prepared.length);
  u16(prepared.length);
  u32(offset - centralStart);
  u32(centralStart);
  u16(0);

  return output;
}
