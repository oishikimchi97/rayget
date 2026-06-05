import { describe, expect, it } from "vitest";
import { cloneUrl, parseSource, sourceId, webUrl } from "../src/url-parse.js";

describe("parseSource", () => {
  it("parses a plain https repo URL", () => {
    const p = parseSource("https://github.com/owner/repo");
    expect(p).toMatchObject({ host: "github.com", owner: "owner", repo: "repo" });
    expect(p.ref).toBeUndefined();
    expect(p.subdir).toBeUndefined();
  });

  it("strips a trailing .git and slash", () => {
    expect(parseSource("https://github.com/owner/repo.git/")).toMatchObject({
      owner: "owner",
      repo: "repo",
    });
  });

  it("parses a /tree/<ref>/<subdir> monorepo URL", () => {
    const p = parseSource("https://github.com/owner/repo/tree/main/packages/ext");
    expect(p).toMatchObject({
      owner: "owner",
      repo: "repo",
      ref: "main",
      subdir: "packages/ext",
    });
  });

  it("parses a /tree/<ref> URL with no subdir", () => {
    const p = parseSource("https://github.com/owner/repo/tree/v1.2.3");
    expect(p).toMatchObject({ owner: "owner", repo: "repo", ref: "v1.2.3" });
    expect(p.subdir).toBeUndefined();
  });

  it("accepts owner/repo shorthand", () => {
    expect(parseSource("owner/repo")).toMatchObject({
      host: "github.com",
      owner: "owner",
      repo: "repo",
    });
  });

  it("lets --ref and --path override parsed values", () => {
    const p = parseSource("https://github.com/owner/repo/tree/main/sub", {
      ref: "dev",
      path: "other",
    });
    expect(p.ref).toBe("dev");
    expect(p.subdir).toBe("other");
  });

  it("rejects garbage with a usage error", () => {
    expect(() => parseSource("not a url")).toThrow(/cannot parse/i);
  });

  it("derives id, clone URL, and web URL", () => {
    const p = parseSource("https://github.com/owner/repo/tree/main/packages/ext");
    expect(sourceId(p)).toBe("owner/repo/packages/ext");
    expect(sourceId(parseSource("owner/repo"))).toBe("owner/repo");
    expect(cloneUrl(p)).toBe("https://github.com/owner/repo.git");
    expect(webUrl(p)).toBe("https://github.com/owner/repo");
  });
});
