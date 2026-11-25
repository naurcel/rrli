import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatCompactNumber,
  formatCompactPeso,
  formatPesoCompact,
  formatPhoneNumber,
} from "./format.ts";

describe("formatCompactNumber", () => {
  it("formats numbers under 1M normally without abbreviation", () => {
    assert.equal(formatCompactNumber(0).display, "0");
    assert.equal(formatCompactNumber(500).display, "500");
    assert.equal(formatCompactNumber(87500).display, "87,500");
    assert.equal(formatCompactNumber(999999).display, "999,999");
    assert.equal(formatCompactNumber(87500).isAbbr, false);
    assert.equal(formatCompactNumber(87500).full, "87,500");
  });

  it("abbreviates millions with M and up to 2 decimal places", () => {
    const res1 = formatCompactNumber(12500000);
    assert.equal(res1.display, "12.5M");
    assert.equal(res1.full, "12,500,000");
    assert.equal(res1.isAbbr, true);

    const res2 = formatCompactNumber(1000000);
    assert.equal(res2.display, "1M");
    assert.equal(res2.full, "1,000,000");

    const res3 = formatCompactNumber(1456789);
    assert.equal(res3.display, "1.46M");
  });

  it("abbreviates billions with B and trillions with T", () => {
    const bRes = formatCompactNumber(1600000000);
    assert.equal(bRes.display, "1.6B");
    assert.equal(bRes.isAbbr, true);
    assert.equal(bRes.full, "1,600,000,000");

    const tRes = formatCompactNumber(2500000000000);
    assert.equal(tRes.display, "2.5T");
    assert.equal(tRes.isAbbr, true);
  });

  it("handles negative numbers correctly with sign preserved", () => {
    const negM = formatCompactNumber(-12500000);
    assert.equal(negM.display, "-12.5M");
    assert.equal(negM.full, "-12,500,000");
    assert.equal(negM.isAbbr, true);

    const negUnder = formatCompactNumber(-45000);
    assert.equal(negUnder.display, "-45,000");
    assert.equal(negUnder.isAbbr, false);
  });

  it("handles null and invalid numbers cleanly", () => {
    assert.equal(formatCompactNumber(null).display, "N/A");
    assert.equal(formatCompactNumber(undefined).display, "N/A");
    assert.equal(formatCompactNumber(NaN).display, "N/A");
  });
});

describe("formatCompactPeso", () => {
  it("formats standard amounts under ₱1M with full currency formatting", () => {
    const res = formatCompactPeso(87500);
    assert.equal(res.display, "₱87,500");
    assert.equal(res.full, "₱87,500");
    assert.equal(res.isAbbr, false);
  });

  it("abbreviates millions and billions with ₱ prefix", () => {
    const resM = formatCompactPeso(12500000);
    assert.equal(resM.display, "₱12.5M");
    assert.equal(resM.full, "₱12,500,000");
    assert.equal(resM.isAbbr, true);

    const resB = formatCompactPeso(1600000000);
    assert.equal(resB.display, "₱1.6B");
    assert.equal(resB.full, "₱1,600,000,000");
    assert.equal(resB.isAbbr, true);
  });

  it("handles negative amounts correctly", () => {
    const resNeg = formatCompactPeso(-12500000);
    assert.equal(resNeg.display, "-₱12.5M");
    assert.equal(resNeg.full, "-₱12,500,000");
    assert.equal(resNeg.isAbbr, true);
  });

  it("formatPesoCompact shorthand returns display string", () => {
    assert.equal(formatPesoCompact(12500000), "₱12.5M");
    assert.equal(formatPesoCompact(87500), "₱87,500");
    assert.equal(formatPesoCompact(null), "N/A");
  });
});

describe("formatPhoneNumber", () => {
  it("formats international +63 numbers to 09XXXXXXXXX", () => {
    assert.equal(formatPhoneNumber("+63 917 123 4567"), "09171234567");
    assert.equal(formatPhoneNumber("+639204567890"), "09204567890");
    assert.equal(formatPhoneNumber("+63 918 234 5678"), "09182345678");
  });

  it("formats 63 prefixed numbers without + to 09XXXXXXXXX", () => {
    assert.equal(formatPhoneNumber("639193456789"), "09193456789");
  });

  it("adds leading 0 to 10-digit 9XXXXXXXXX numbers", () => {
    assert.equal(formatPhoneNumber("9215678901"), "09215678901");
    assert.equal(formatPhoneNumber("922 678 9012"), "09226789012");
  });

  it("preserves already valid 11-digit 09XXXXXXXXX numbers", () => {
    assert.equal(formatPhoneNumber("09948795127"), "09948795127");
    assert.equal(formatPhoneNumber("0917-123-4567"), "09171234567");
  });

  it("handles empty or null values gracefully", () => {
    assert.equal(formatPhoneNumber(""), "");
    assert.equal(formatPhoneNumber(null), "");
    assert.equal(formatPhoneNumber(undefined), "");
  });
});
