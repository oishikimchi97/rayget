import { describe, expect, it } from "vitest";
import { parseSource } from "../src/url-parse.js";
import { cellarDirName, raygetPaths } from "../src/paths.js";

describe("raygetPaths", () => {
  it("derives all paths under a given home", () => {
    const p = raygetPaths("/home/u");
    expect(p.root).toBe("/home/u/.rayget");
    expect(p.cellar).toBe("/home/u/.rayget/cellar");
    expect(p.manifest).toBe("/home/u/.rayget/manifest.json");
    expect(p.log).toBe("/home/u/.rayget/rayget.log");
  });
});

describe("cellarDirName", () => {
  it("joins owner and repo with a double underscore", () => {
    expect(cellarDirName(parseSource("owner/repo"))).toBe("owner__repo");
  });

  it("appends a flattened subdir for monorepos", () => {
    const p = parseSource("https://github.com/owner/repo/tree/main/packages/ext");
    expect(cellarDirName(p)).toBe("owner__repo__packages_ext");
  });
});
