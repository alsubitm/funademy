import { describe, it, expect } from "vitest";
import { hashPin, verifyPin, hashPassword } from "./auth";

describe("PIN hashing and verification", () => {
  it("hashPin produces a scrypt salt:hash, never the plaintext PIN", () => {
    const stored = hashPin("1234");
    expect(stored).not.toContain("1234");
    const [salt, hash] = stored.split(":");
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(hash).toMatch(/^[0-9a-f]{128}$/);
  });

  it("hashPin salts each hash (same PIN → different stored values)", () => {
    expect(hashPin("1234")).not.toBe(hashPin("1234"));
  });

  it("verifyPin accepts the correct PIN against a hashed value", () => {
    const stored = hashPin("4321");
    expect(verifyPin("4321", stored)).toEqual({ ok: true, legacy: false });
  });

  it("verifyPin rejects a wrong PIN against a hashed value", () => {
    const stored = hashPin("4321");
    expect(verifyPin("0000", stored)).toEqual({ ok: false, legacy: false });
  });

  it("verifyPin accepts legacy plaintext rows and flags them for upgrade", () => {
    expect(verifyPin("7777", "7777")).toEqual({ ok: true, legacy: true });
  });

  it("verifyPin rejects wrong PINs against legacy plaintext rows", () => {
    expect(verifyPin("7776", "7777")).toEqual({ ok: false, legacy: true });
  });

  it("uses the same scrypt scheme as passwords", () => {
    const stored = hashPassword("1234");
    expect(verifyPin("1234", stored)).toEqual({ ok: true, legacy: false });
  });
});
