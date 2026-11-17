// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {assert} from 'chai';
import {describe, it} from 'mocha';

import {createZip} from './ExportZip.js';

function readU16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function firstEntryData(zip: Uint8Array): string {
  const view = new DataView(zip.buffer);
  const nameLength = readU16(view, 26);
  const extraLength = readU16(view, 28);
  const size = readU32(view, 18);
  const start = 30 + nameLength + extraLength;
  return new TextDecoder().decode(zip.slice(start, start + size));
}

describe('ExportZip', () => {
  it('writes a store-method ZIP with a central directory', () => {
    const zip = createZip([{path: 'nested/hello.txt', data: new TextEncoder().encode('hello')}]);
    const view = new DataView(zip.buffer);
    assert.strictEqual(readU32(view, 0), 0x04034b50);
    assert.strictEqual(firstEntryData(zip), 'hello');

    const eocd = zip.length - 22;
    assert.strictEqual(readU32(view, eocd), 0x06054b50);
    assert.strictEqual(readU16(view, eocd + 10), 1);
    const centralOffset = readU32(view, eocd + 16);
    assert.strictEqual(readU32(view, centralOffset), 0x02014b50);
  });

  it('renames duplicate paths instead of overwriting', () => {
    const zip = createZip([
      {path: 'same.txt', data: new TextEncoder().encode('one')},
      {path: 'same.txt', data: new TextEncoder().encode('two')},
    ]);
    const view = new DataView(zip.buffer);
    const eocd = zip.length - 22;
    assert.strictEqual(readU16(view, eocd + 10), 2);
    assert.strictEqual(firstEntryData(zip), 'one');
  });
});
