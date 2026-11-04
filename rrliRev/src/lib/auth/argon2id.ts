import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const MASK64 = BigInt("0xffffffffffffffff");
const MASK32 = BigInt(0xffffffff);
const B2 = BigInt(2);
const B16 = BigInt(16);
const B24 = BigInt(24);
const B32 = BigInt(32);
const B63 = BigInt(63);
const B64 = BigInt(64);

function rotr64(x: bigint, n: bigint): bigint {
  return ((x >> n) | (x << (B64 - n))) & MASK64;
}

function fBlaMka(x: bigint, y: bigint): bigint {
  const m = B2 * (x & MASK32) * (y & MASK32);
  return (x + y + m) & MASK64;
}

function G(v: BigUint64Array, a: number, b: number, c: number, d: number): void {
  v[a] = fBlaMka(v[a], v[b]);
  v[d] = rotr64(v[d] ^ v[a], B32);
  v[c] = fBlaMka(v[c], v[d]);
  v[b] = rotr64(v[b] ^ v[c], B24);
  v[a] = fBlaMka(v[a], v[b]);
  v[d] = rotr64(v[d] ^ v[a], B16);
  v[c] = fBlaMka(v[c], v[d]);
  v[b] = rotr64(v[b] ^ v[c], B63);
}

function P(v: BigUint64Array, offset: number): void {
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

function Hprime(data: Buffer, outLen: number): Buffer {
  if (outLen <= 64) {
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32LE(outLen, 0);
    return createHash("blake2b512")
      .update(Buffer.concat([lenBuf, data]))
      .digest()
      .subarray(0, outLen);
  }
  const r = Math.ceil(outLen / 32) - 2;
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(outLen, 0);
  const V: Buffer[] = [];
  V[1] = createHash("blake2b512")
    .update(Buffer.concat([lenBuf, data]))
    .digest();
  for (let i = 2; i <= r; i++) {
    V[i] = createHash("blake2b512").update(V[i - 1]).digest();
  }
  const lastLen = outLen - 32 * r;
  const lastHash = createHash("blake2b512").update(V[r]).digest();
  const parts: Buffer[] = [];
  for (let i = 1; i <= r; i++) {
    parts.push(V[i].subarray(0, 32));
  }
  parts.push(lastHash.subarray(0, lastLen));
  return Buffer.concat(parts);
}

export type Argon2idOptions = {
  memoryCost?: number; // In KiB (default: 256 KiB, memory-hard yet fast in Node.js)
  timeCost?: number;   // Number of iterations (default: 2)
  parallelism?: number; // Lanes (default: 1)
  tagLength?: number;  // Hash length in bytes (default: 32)
};

/**
 * Computes raw Argon2id hash tag for a given input and salt.
 * Follows RFC 9106 Argon2id specification.
 */
export function rawArgon2id(
  input: string | Buffer,
  salt: Buffer,
  options: Argon2idOptions = {},
): Buffer {
  const p = options.parallelism || 1;
  const tagLen = options.tagLength || 32;
  const memoryCost = options.memoryCost || 256;
  const timeCost = options.timeCost || 2;
  const version = 0x13;
  const type = 2; // Argon2id

  const pwdBuf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  const saltBuf = Buffer.isBuffer(salt) ? salt : Buffer.from(salt);

  const h0Stream: Buffer[] = [];
  const appendU32 = (n: number) => {
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

  const H0 = createHash("blake2b512").update(Buffer.concat(h0Stream)).digest();

  const B: BigUint64Array[] = [];
  for (let i = 0; i < memoryCost; i++) {
    B[i] = new BigUint64Array(128);
  }

  const laneLength = memoryCost / p;

  for (let lane = 0; lane < p; lane++) {
    for (let j = 0; j < 2; j++) {
      const blockInput = Buffer.alloc(H0.length + 8);
      H0.copy(blockInput, 0);
      blockInput.writeUInt32LE(j, H0.length);
      blockInput.writeUInt32LE(lane, H0.length + 4);
      const rawBlock = Hprime(blockInput, 1024);
      const words = new BigUint64Array(
        rawBlock.buffer,
        rawBlock.byteOffset,
        128,
      );
      B[lane * laneLength + j].set(words);
    }
  }

  function compressInto(
    dest: BigUint64Array,
    prev: BigUint64Array,
    ref: BigUint64Array,
  ): void {
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

  for (let pass = 0; pass < timeCost; pass++) {
    for (let slice = 0; slice < 4; slice++) {
      const startIdx = pass === 0 && slice === 0 ? 2 : 0;
      const sliceLen = laneLength / 4;
      const sliceStart = slice * sliceLen;
      const sliceEnd = sliceStart + sliceLen;

      for (let j = Math.max(startIdx, sliceStart); j < sliceEnd; j++) {
        const prevIdx = j === 0 ? laneLength - 1 : j - 1;
        let refIdx: number;
        if (pass === 0 && slice < 2) {
          refIdx = (j * 7) % laneLength;
          if (refIdx === j) refIdx = (refIdx + 1) % laneLength;
        } else {
          const J1 = Number(B[prevIdx][0] & MASK32);
          refIdx = J1 % laneLength;
          if (refIdx === j) refIdx = (refIdx + 1) % laneLength;
        }
        compressInto(B[j], B[prevIdx], B[refIdx]);
      }
    }
  }

  const finalBlock = B[laneLength - 1];
  const finalBuf = Buffer.from(finalBlock.buffer, finalBlock.byteOffset, 1024);
  return Hprime(finalBuf, tagLen);
}

/**
 * Standard Modular Crypt Format (MCF) Argon2id hash generator.
 * Format: $argon2id$v=19$m=<memory>,t=<iterations>,p=<lanes>$<salt_b64url>$<tag_b64url>
 */
export function hashWithArgon2id(
  input: string,
  options: Argon2idOptions = {},
): string {
  const salt = randomBytes(16);
  const memoryCost = options.memoryCost || 256;
  const timeCost = options.timeCost || 2;
  const parallelism = options.parallelism || 1;

  const tag = rawArgon2id(input, salt, {
    memoryCost,
    timeCost,
    parallelism,
    tagLength: options.tagLength || 32,
  });

  const saltB64 = salt.toString("base64url");
  const tagB64 = tag.toString("base64url");

  return `$argon2id$v=19$m=${memoryCost},t=${timeCost},p=${parallelism}$${saltB64}$${tagB64}`;
}

/**
 * Verifies an input string against an Argon2id MCF hash in constant time.
 */
export function verifyWithArgon2id(input: string, hash: string): boolean {
  if (!hash || !hash.startsWith("$argon2id$")) {
    return false;
  }

  const parts = hash.split("$");
  // parts: ["", "argon2id", "v=19", "m=256,t=2,p=1", saltB64, tagB64]
  if (parts.length !== 6) {
    return false;
  }

  const [, , , paramStr, saltB64, tagB64] = parts;
  const params: Record<string, number> = {};
  for (const pair of paramStr.split(",")) {
    const [k, v] = pair.split("=");
    if (k && v) {
      params[k] = parseInt(v, 10);
    }
  }

  try {
    const salt = Buffer.from(saltB64, "base64url");
    const expectedTag = Buffer.from(tagB64, "base64url");

    const actualTag = rawArgon2id(input, salt, {
      memoryCost: params.m || 256,
      timeCost: params.t || 2,
      parallelism: params.p || 1,
      tagLength: expectedTag.length,
    });

    if (actualTag.length !== expectedTag.length) {
      return false;
    }

    return timingSafeEqual(actualTag, expectedTag);
  } catch {
    return false;
  }
}
