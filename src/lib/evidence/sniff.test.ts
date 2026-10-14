import { describe, expect, it } from "vitest";
import { contentMatchesType, sniffType } from "./sniff";

const bytes = (...parts: (number[] | string)[]) =>
  Uint8Array.from(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));

const pad = (b: Uint8Array) => Uint8Array.from([...b, ...new Array(32).fill(0)]);

describe("sniffType", () => {
  it.each([
    ["image/jpeg", bytes([0xff, 0xd8, 0xff, 0xe0])],
    ["image/png", bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a])],
    ["image/webp", bytes("RIFF", [1, 2, 3, 4], "WEBP")],
    ["image/heic", bytes([0, 0, 0, 0x18], "ftypheic")],
    ["application/pdf", bytes("%PDF-1.7")],
    ["audio/mpeg", bytes("ID3", [4, 0])],
    ["audio/mpeg", bytes([0xff, 0xfb, 0x90])],
    ["audio/mp4", bytes([0, 0, 0, 0x20], "ftypM4A ")],
    ["audio/wav", bytes("RIFF", [1, 2, 3, 4], "WAVE")],
    ["audio/ogg", bytes("OggS")],
    ["audio/webm", bytes([0x1a, 0x45, 0xdf, 0xa3])],
    ["audio/aac", bytes([0xff, 0xf1, 0x50])],
  ])("recognises %s", (type, b) => {
    expect(sniffType(pad(b))).toBe(type);
  });

  it("returns null for unknown content, including executables and HTML", () => {
    expect(sniffType(pad(bytes("MZ", [0x90, 0])))).toBeNull();
    expect(sniffType(pad(bytes("<!doctype html>")))).toBeNull();
    expect(sniffType(new Uint8Array())).toBeNull();
  });
});

describe("contentMatchesType", () => {
  it("accepts content that matches the declared type, treating aliases alike", () => {
    expect(contentMatchesType(pad(bytes([0, 0, 0, 0x20], "ftypM4A ")), "audio/x-m4a")).toBe(true);
    expect(contentMatchesType(pad(bytes([0, 0, 0, 0x18], "ftypmif1")), "image/heif")).toBe(true);
    expect(contentMatchesType(pad(bytes("RIFF", [0, 0, 0, 0], "WAVE")), "audio/x-wav")).toBe(true);
  });

  it("rejects a file whose content is not what it claims to be", () => {
    expect(contentMatchesType(pad(bytes("%PDF-1.4")), "image/jpeg")).toBe(false);
    expect(contentMatchesType(pad(bytes("MZ")), "application/pdf")).toBe(false);
  });
});
