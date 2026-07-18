const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(size, r, g, b) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type);
    const crcInput = Buffer.concat([typeB, data]);
    let c = 0xffffffff;
    const tbl = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let v = n;
      for (let k = 0; k < 8; k++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
      tbl[n] = v;
    }
    for (let i = 0; i < crcInput.length; i++) c = tbl[(c ^ crcInput[i]) & 0xff] ^ (c >>> 8);
    c = (c ^ 0xffffffff) >>> 0;
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(c);
    return Buffer.concat([len, typeB, data, crc]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB

  // Raw image: each row starts with filter byte 0 (none)
  const rowBytes = 1 + size * 3;
  const raw = Buffer.alloc(rowBytes * size);
  const cx = size / 2, cy = size / 2;
  const outerR = size * 0.45;
  const cornerR = size * 0.18;

  for (let y = 0; y < size; y++) {
    const row = y * rowBytes;
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const px = row + 1 + x * 3;
      const dx = x - cx, dy = y - cy;

      // Rounded rectangle mask
      let inside = false;
      const ax = Math.max(0, Math.abs(dx) - (cx - cornerR));
      const ay = Math.max(0, Math.abs(dy) - (cy - cornerR));
      if (Math.sqrt(ax * ax + ay * ay) <= cornerR || 
          (Math.abs(dx) <= cx - cornerR) || 
          (Math.abs(dy) <= cy - cornerR)) {
        inside = true;
      }

      if (inside) {
        // Draw "C" letter: white on colored background
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const letterOuter = size * 0.30;
        const letterInner = size * 0.15;
        const thickness = size * 0.08;
        const inStroke = dist >= letterInner && dist <= letterOuter;

        // C shape: open on the right side
        const isOpening = Math.abs(angle) < 0.6 && dx > 0;

        if (inStroke && !isOpening) {
          raw[px] = 255; raw[px+1] = 255; raw[px+2] = 255;
        } else {
          raw[px] = r; raw[px+1] = g; raw[px+2] = b;
        }
      } else {
        // Outside: transparent-looking (cream)
        raw[px] = 245; raw[px+1] = 238; raw[px+2] = 230;
      }
    }
  }

  const compressed = zlib.deflateSync(raw);
  const iend = makeChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, makeChunk('IHDR', ihdr), makeChunk('IDAT', compressed), iend]);
}

const dir = path.join(__dirname, 'public');
fs.writeFileSync(path.join(dir, 'icon-192.png'), createPNG(192, 224, 133, 34));
fs.writeFileSync(path.join(dir, 'icon-512.png'), createPNG(512, 224, 133, 34));
console.log('PWA icons generated.');
