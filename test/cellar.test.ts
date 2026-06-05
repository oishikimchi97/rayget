import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { isRaycastManifest, locateExtensionRoot, readPackageJson } from "../src/cellar.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "fixtures");

describe("isRaycastManifest", () => {
  it("accepts a package with the extension schema and commands", () => {
    expect(
      isRaycastManifest({
        $schema: "https://www.raycast.com/schemas/extension.json",
        commands: [{ name: "x" }],
      }),
    ).toBe(true);
  });

  it("rejects a package missing commands or schema", () => {
    expect(isRaycastManifest({ name: "x" })).toBe(false);
    expect(isRaycastManifest({ commands: [] })).toBe(false);
    expect(isRaycastManifest(null)).toBe(false);
  });
});

describe("locateExtensionRoot", () => {
  it("finds the root at the top level", () => {
    expect(locateExtensionRoot(join(fixtures, "single"))).toBe(join(fixtures, "single"));
  });

  it("finds the root in an explicit subdir", () => {
    const root = locateExtensionRoot(join(fixtures, "mono"), "packages/ext");
    expect(root).toBe(join(fixtures, "mono", "packages", "ext"));
  });

  it("throws a clear error when no extension manifest exists", () => {
    expect(() => locateExtensionRoot(join(fixtures, "none"))).toThrow(/no raycast extension/i);
  });
});

describe("readPackageJson", () => {
  it("reads name and title", () => {
    const pkg = readPackageJson(join(fixtures, "single"));
    expect(pkg.name).toBe("single-ext");
    expect(pkg.title).toBe("Single Ext");
  });
});
