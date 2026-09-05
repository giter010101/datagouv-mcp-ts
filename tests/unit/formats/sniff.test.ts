import { describe, expect, it } from "vitest";
import { sniffBytes, sniffedKindToFormat } from "../../../src/formats/sniff.js";

const enc = (s: string) => new TextEncoder().encode(s);

describe("sniffBytes — research/03 magic numbers", () => {
  it("recognises zip, gzip, parquet, pdf, png, jpeg, ole, sqlite", () => {
    expect(sniffBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04])).kind).toBe("zip");
    expect(sniffBytes(new Uint8Array([0x1f, 0x8b, 0x08])).kind).toBe("gzip");
    expect(sniffBytes(enc("PAR1....")).kind).toBe("parquet");
    expect(sniffBytes(enc("%PDF-1.4")).kind).toBe("pdf");
    expect(sniffBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47])).kind).toBe("png");
    expect(sniffBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])).kind).toBe("jpeg");
    expect(sniffBytes(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0])).kind).toBe("ole");
    expect(sniffBytes(enc("SQLite format 3\0")).kind).toBe("sqlite");
  });

  it("classifies html, xml, json array/object, csv/tsv text", () => {
    expect(sniffBytes(enc("<!DOCTYPE html><html>")).kind).toBe("html");
    expect(sniffBytes(enc('<?xml version="1.0"?><a/>')).kind).toBe("xml");
    expect(sniffBytes(enc('[{"a":1}]')).kind).toBe("json-array");
    expect(sniffBytes(enc('{"a":1}')).kind).toBe("json-object");
    expect(sniffBytes(enc("id;nom\n1;a\n")).textHint).toBe("csv");
    expect(sniffBytes(enc("id\tnom\n1\ta\n")).textHint).toBe("tsv");
    expect(sniffBytes(enc('{"a":1}\n{"a":2}\n')).textHint).toBe("jsonl");
  });

  it("maps sniffed kinds to detector formats", () => {
    expect(sniffedKindToFormat(sniffBytes(enc("PAR1")))).toBe("parquet");
    expect(sniffedKindToFormat(sniffBytes(enc('[{"x":1}]')))).toBe("json");
    expect(sniffedKindToFormat(sniffBytes(new Uint8Array(0)))).toBeUndefined();
  });
});
