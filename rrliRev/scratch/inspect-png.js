const fs = require('fs');
const zlib = require('zlib');

const buf = fs.readFileSync('C:/Users/suchi/.gemini/antigravity/brain/c025c70b-721e-4112-9738-aa40796a0b17/.user_uploaded/media_1793750956750_687ca103.png');
let pos = 8;
const chunks = [];
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos);
  const type = buf.slice(pos + 4, pos + 8).toString('ascii');
  if (type === 'IDAT') chunks.push(buf.slice(pos + 8, pos + 8 + len));
  pos += 12 + len;
}
const raw = zlib.inflateSync(Buffer.concat(chunks));
const width = 546;
const height = 125;
const bpp = 4;
const stride = width * bpp;
const uncompressed = Buffer.alloc(width * height * bpp);

let rawOff = 0;
for (let y = 0; y < height; y++) {
  const filter = raw[rawOff++];
  for (let x = 0; x < stride; x++) {
    const rawByte = raw[rawOff++];
    const a = x >= bpp ? uncompressed[y * stride + x - bpp] : 0;
    const b = y > 0 ? uncompressed[(y - 1) * stride + x] : 0;
    const c = (x >= bpp && y > 0) ? uncompressed[(y - 1) * stride + x - bpp] : 0;
    let val = 0;
    if (filter === 0) val = rawByte;
    else if (filter === 1) val = (rawByte + a) & 0xff;
    else if (filter === 2) val = (rawByte + b) & 0xff;
    else if (filter === 3) val = (rawByte + Math.floor((a + b) / 2)) & 0xff;
    else if (filter === 4) {
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      val = (rawByte + pr) & 0xff;
    }
    uncompressed[y * stride + x] = val;
  }
}

function getPixel(x, y) {
  const off = (y * width + x) * 4;
  return [uncompressed[off], uncompressed[off+1], uncompressed[off+2], uncompressed[off+3]];
}

console.log('Button background (x=100, y=25):', getPixel(100, 25));
console.log('Button corner (x=1, y=1):', getPixel(1, 1));
console.log('Button corner (x=10, y=10):', getPixel(10, 10));
console.log('Button corner (x=20, y=20):', getPixel(20, 20));
console.log('Background below button (x=273, y=65):', getPixel(273, 65));
console.log('Text area (x=273, y=85):', getPixel(273, 85));

// Find button bounds:
let minX = width, maxX = 0, minY = height, maxY = 0;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const p = getPixel(x, y);
    // check if it's the blue button:
    if (p[2] > 200 && p[1] > 80 && p[0] < 50) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
console.log(`Blue button bounds: x=[${minX}, ${maxX}] (${maxX - minX + 1}px wide), y=[${minY}, ${maxY}] (${maxY - minY + 1}px high)`);
console.log('Sample blue color at (minX+50, minY+25):', getPixel(minX + 50, minY + 25));

// Check text "Forgot password?" bounds:
let textMinY = height, textMaxY = 0;
for (let y = maxY + 1; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const p = getPixel(x, y);
    // dark pixel (text)
    if (p[0] < 50 && p[1] < 50 && p[2] < 50) {
      if (y < textMinY) textMinY = y;
      if (y > textMaxY) textMaxY = y;
    }
  }
}
console.log(`Forgot password text y bounds: [${textMinY}, ${textMaxY}], distance from button bottom: ${textMinY - maxY}px`);