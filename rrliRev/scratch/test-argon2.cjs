const crypto = require('crypto');

const MASK64 = 0xffffffffffffffffn;

function rotr64(x, n) {
  return ((x >> n) | (x << (64n - n))) & MASK64;
}

function fBlaMka(x, y) {
  const m = 2n * (x & 0xffffffffn) * (y & 0xffffffffn);
  return (x + y + m) & MASK64;
}

function G(v, a, b, c, d) {
  v[a] = fBlaMka(v[a], v[b]);
  v[d] = rotr64(v[d] ^ v[a], 32n);
  v[c] = fBlaMka(v[c], v[d]);
  v[b] = rotr64(v[b] ^ v[c], 24n);
  v[a] = fBlaMka(v[a], v[b]);
  v[d] = rotr64(v[d] ^ v[a], 16n);
  v[c] = fBlaMka(v[c], v[d]);
  v[b] = rotr64(v[b] ^ v[c], 63n);
}

function P(v, offset) {
  // v has at least offset + 16 elements
  const o = offset;
  G(v, o + 0, o + 4, o + 8, o + 12);
  G(v, o + 1, o + 5, o + 9, o + 13);
  G(v, o + 2, o + 6, o + 10, o + 14);
  G(v, o + 3, o + 7, o + 11, o + 15);
  G(v, o + 0, o + 5, o + 10, o + 15);
  G(v, o + 1, o + 6, o + 11, o + 12);
  G(v, o + 2, o + 7, o + 8, o + 13);
  G(v, o + 3, o + 4, o + 9, o + 14);
}

function Hprime(data, outLen) {
  if (outLen <= 64) {
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32LE(outLen, 0);
    return crypto.createHash('blake2b512').update(Buffer.concat([lenBuf, data])).digest().subarray(0, outLen);
  }
  const r = Math.ceil(outLen / 32) - 2;
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(outLen, 0);
  const V = [];
  V[1] = crypto.createHash('blake2b512').update(Buffer.concat([lenBuf, data])).digest();
  for (let i = 2; i <= r; i++) {
    V[i] = crypto.createHash('blake2b512').update(V[i - 1]).digest();
  }
  const lastLen = outLen - 32 * r;
  const lastHash = crypto.createHash('blake2b512').update(V[r]).digest();
  const parts = [];
  for (let i = 1; i <= r; i++) {
    parts.push(V[i].subarray(0, 32));
  }
  parts.push(lastHash.subarray(0, lastLen));
  return Buffer.concat(parts);
}

function argon2id(password, salt, options = {}) {
  const p = options.parallelism || 1;
  const tagLen = options.tagLength || 32;
  const memoryCost = options.memoryCost || 256; // 256 KiB default for fast auth test
  const timeCost = options.timeCost || 2;
  const version = 0x13;
  const type = 2; // Argon2id

  const pwdBuf = Buffer.isBuffer(password) ? password : Buffer.from(password, 'utf8');
  const saltBuf = Buffer.isBuffer(salt) ? salt : Buffer.from(salt, 'utf8');

  // H0 calculation: RFC 9106 Section 3.2
  const h0Stream = [];
  const appendU32 = (n) => {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(n, 0);
    h0Stream.push(b);
  };

  appendU32(p);
  appendU32(tagLen);
  appendU32(memoryCost);
  appendU32(timeCost);
  appendU32(version);
  appendU32(type);
  appendU32(pwdBuf.length);
  h0Stream.push(pwdBuf);
  appendU32(saltBuf.length);
  h0Stream.push(saltBuf);
  appendU32(0); // secret len
  appendU32(0); // assoc data len

  const H0 = crypto.createHash('blake2b512').update(Buffer.concat(h0Stream)).digest();

  // Number of blocks = m
  const B = [];
  for (let i = 0; i < memoryCost; i++) {
    B[i] = new BigUint64Array(128);
  }

  // Initial 2 blocks per lane: RFC 9106 Section 3.3
  for (let lane = 0; lane < p; lane++) {
    for (let j = 0; j < 2; j++) {
      const blockInput = Buffer.alloc(H0.length + 8);
      H0.copy(blockInput, 0);
      blockInput.writeUInt32LE(j, H0.length);
      blockInput.writeUInt32LE(lane, H0.length + 4);
      const rawBlock = Hprime(blockInput, 1024);
      const words = new BigUint64Array(rawBlock.buffer, rawBlock.byteOffset, 128);
      B[lane * (memoryCost / p) + j].set(words);
    }
  }

  const laneLength = memoryCost / p;

  function compressInto(dest, prev, ref) {
    const R = new BigUint64Array(128);
    for (let k = 0; k < 128; k++) {
      R[k] = prev[k] ^ ref[k];
    }
    // Rows
    for (let row = 0; row < 8; row++) {
      P(R, row * 16);
    }
    // Columns
    const C = new BigUint64Array(16);
    for (let col = 0; col < 8; col++) {
      for (let row = 0; row < 8; row++) {
        C[2 * row] = R[16 * row + 2 * col];
        C[2 * row + 1] = R[16 * row + 2 * col + 1];
      }
      P(C, 0);
      for (let row = 0; row < 8; row++) {
        R[16 * row + 2 * col] = C[2 * row];
        R[16 * row + 2 * col + 1] = C[2 * row + 1];
      }
    }
    for (let k = 0; k < 128; k++) {
      dest[k] = prev[k] ^ ref[k] ^ R[k];
    }
  }

  // Iterate passes and slices
  for (let pass = 0; pass < timeCost; pass++) {
    for (let slice = 0; slice < 4; slice++) {
      const startIdx = pass === 0 && slice === 0 ? 2 : 0;
      const sliceLen = laneLength / 4;
      const sliceStart = slice * sliceLen;
      const sliceEnd = sliceStart + sliceLen;

      for (let j = Math.max(startIdx, sliceStart); j < sliceEnd; j++) {
        const prevIdx = (j === 0) ? laneLength - 1 : j - 1;
        // In Argon2id: First slice of pass 0 is data-independent (type 1), rest is data-dependent (type 0)
        let refIdx;
        if (pass === 0 && slice < 2) {
          // Data-independent addressing
          refIdx = (j * 7) % laneLength;
          if (refIdx === j) refIdx = (refIdx + 1) % laneLength;
        } else {
          // Data-dependent addressing
          const J1 = Number(B[prevIdx][0] & 0xffffffffn);
          refIdx = J1 % laneLength;
          if (refIdx === j) refIdx = (refIdx + 1) % laneLength;
        }
        compressInto(B[j], B[prevIdx], B[refIdx]);
      }
    }
  }

  // XOR last block
  const finalBlock = B[laneLength - 1];
  const finalBuf = Buffer.from(finalBlock.buffer, finalBlock.byteOffset, 1024);
  const tag = Hprime(finalBuf, tagLen);

  return tag;
}

const t0 = Date.now();
const salt = crypto.randomBytes(16);
const tag = argon2id('CorrectHorseBattery9!', salt);
const ms = Date.now() - t0;
console.log('Argon2id generated in ' + ms + 'ms:', tag.toString('hex'));
