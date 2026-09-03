import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkLayers, formatViolations, layerOf } from "../../scripts/check-layers.js";

describe("layering (core ← clients ← formats ← tools ← server)", () => {
  it("the real src/ tree has no upward imports", () => {
    const violations = checkLayers(resolve(process.cwd(), "src"));
    expect(violations, formatViolations(violations)).toEqual([]);
  });

  it("layerOf maps paths to layers", () => {
    expect(layerOf("core/errors.ts")).toBe("core");
    expect(layerOf("tools/shared/x.ts")).toBe("tools");
    expect(layerOf("index.ts")).toBeUndefined();
  });

  describe("detects an upward import in a synthetic tree", () => {
    let dir: string;
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    it("flags core importing from tools", () => {
      dir = mkdtempSync(join(tmpdir(), "layers-"));
      mkdirSync(join(dir, "core"));
      mkdirSync(join(dir, "tools"));
      writeFileSync(join(dir, "tools", "a.ts"), "export const a = 1;\n");
      writeFileSync(
        join(dir, "core", "b.ts"),
        'import { a } from "../tools/a.js";\nexport const b = a;\n',
      );
      writeFileSync(
        join(dir, "core", "ok.ts"),
        'import type { X } from "./b.js";\nexport type Y = X;\n',
      );
      const violations = checkLayers(dir);
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        fromLayer: "core",
        toLayer: "tools",
        file: join("core", "b.ts"),
      });
    });
  });
});
