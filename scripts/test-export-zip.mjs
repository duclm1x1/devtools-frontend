// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import assert from 'node:assert/strict';

import {createZip} from '../front_end/panels/network/ExportZip.ts';

function u16(view, offset) {
  return view.getUint16(offset, true);
}

function u32(view, offset) {
  return view.getUint32(offset, true);
}

const zip = createZip([
  {path: 'nested/hello.txt', data: new TextEncoder().encode('hello')},
  {path: 'same.txt', data: new TextEncoder().encode('one')},
  {path: 'same.txt', data: new TextEncoder().encode('two')},
]);
const view = new DataView(zip.buffer);

assert.equal(u32(view, 0), 0x04034b50, 'local header signature');
const nameLength = u16(view, 26);
const extraLength = u16(view, 28);
const size = u32(view, 18);
const start = 30 + nameLength + extraLength;
assert.equal(new TextDecoder().decode(zip.slice(start, start + size)), 'hello', 'first entry data');

const eocd = zip.length - 22;
assert.equal(u32(view, eocd), 0x06054b50, 'EOCD signature');
assert.equal(u16(view, eocd + 10), 3, 'entry count');
const centralOffset = u32(view, eocd + 16);
assert.equal(u32(view, centralOffset), 0x02014b50, 'central header signature');

console.log('ExportZip: 2 checks passed.');
