# rayget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `rayget`, a Homebrew-style CLI that installs and manages *unpublished* Raycast extensions from a GitHub URL (`add`/`list`/`upgrade`/`remove`/`doctor`).

**Architecture:** A TypeScript ESM CLI that shells out to `git`, `npm`, and `npx ray`. Pure modules (`url-parse`, `manifest`, `paths`, extension-root detection, `registrar`) are unit-tested with dependency injection; thin shell-out wrappers (git/npm/ray) are exercised by the orchestration commands. State lives in `~/.rayget/` (the "Cellar"): cloned sources under `cellar/`, a `manifest.json` registry, and a `rayget.log`.

**Tech Stack:** Node.js (>=18), TypeScript (ESM, `NodeNext`), `execa` (process spawning), `chalk` (output), `vitest` (tests), `tsx` (dev runner). Arg parsing uses the built-in `node:util` `parseArgs` (zero extra dependency).

**Reference spec:** `docs/specs/2026-06-05-rayget-design.md`.

---

## Conventions for this plan

- **ESM + NodeNext:** every relative import in `src/` uses a `.js` extension (e.g. `import { parseSource } from "./url-parse.js"`), even though the file on disk is `.ts`. This is required for Node ESM at runtime; `tsc` and `vitest` both resolve it correctly.
- **Tests** live in `test/` and import from `../src/<mod>.js`.
- **Exit codes** (from spec §9): `0` ok, `1` generic, `2` usage, `3` environment, `4` git/network, `5` registration. Always thrown via `RaygetError`.
- **TDD:** write the failing test, run it red, implement minimally, run it green, commit.
- Run a single test file with: `npx vitest run test/<name>.test.ts`.

---

## File Structure

```
rayget/
  package.json            # bin, scripts, deps
  tsconfig.json           # ESM/NodeNext, strict
  vitest.config.ts        # node env, test/**/*.test.ts
  src/
    cli.ts                # entry (shebang), arg dispatch, --help/--version
    errors.ts             # RaygetError + EXIT codes
    output.ts             # human/JSON output layer
    log.ts                # rayget.log writer + tail
    paths.ts              # ~/.rayget paths + cellar dir naming
    url-parse.ts          # GitHub URL/shorthand -> ParsedSource (+ id/url helpers)
    manifest.ts           # manifest.json read/write/migrate/upsert/remove + types
    cellar.ts             # git/npm shell-outs + extension-root detection
    registrar.ts          # `npx ray develop` spawn/watch/SIGINT
    env.ts                # doctor checks + register pre-flight
    commands/
      add.ts
      list.ts
      upgrade.ts
      remove.ts
      doctor.ts
  test/
    url-parse.test.ts
    paths.test.ts
    manifest.test.ts
    cellar.test.ts
    registrar.test.ts
    env.test.ts
    fixtures/             # sample extension trees for root detection
```

---

# Milestone M2 — Core add/list/doctor

## Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/cli.ts` (placeholder)
- Create: `test/smoke.test.ts`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "rayget",
  "version": "0.1.0",
  "description": "Homebrew-style CLI to install and manage unpublished Raycast extensions from GitHub",
  "type": "module",
  "bin": { "rayget": "dist/cli.js" },
  "files": ["dist"],
  "engines": { "node": ">=18" },
  "scripts": {
    "build": "tsc -p tsconfig.json && chmod +x dist/cli.js",
    "dev": "tsx src/cli.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "chalk": "^5.3.0",
    "execa": "^9.5.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Write placeholder `src/cli.ts`**

```ts
#!/usr/bin/env node
async function main(): Promise<void> {
  process.stdout.write("rayget\n");
}

main();
```

- [ ] **Step 5: Write `test/smoke.test.ts`**

```ts
import { describe, expect, it } from "vitest";

describe("smoke", () => {
  it("runs the test runner", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Install deps and verify infra**

Run: `cd /Users/YONMGIN/Project/rayget && npm install && npm run typecheck && npm test`
Expected: install succeeds, typecheck prints nothing (exit 0), vitest reports `1 passed`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts src/cli.ts test/smoke.test.ts
git commit -m "chore: scaffold rayget TypeScript CLI project"
```

---

## Task 2: Errors and exit codes

**Files:**
- Create: `src/errors.ts`
- Test: `test/errors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { EXIT, RaygetError } from "../src/errors.js";

describe("errors", () => {
  it("exposes the spec exit codes", () => {
    expect(EXIT).toEqual({
      OK: 0,
      GENERIC: 1,
      USAGE: 2,
      ENV: 3,
      GIT: 4,
      REGISTER: 5,
    });
  });

  it("carries an exit code on the error", () => {
    const err = new RaygetError(EXIT.USAGE, "bad args");
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe(2);
    expect(err.message).toBe("bad args");
    expect(err.name).toBe("RaygetError");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/errors.test.ts`
Expected: FAIL — cannot find module `../src/errors.js`.

- [ ] **Step 3: Write `src/errors.ts`**

```ts
export const EXIT = {
  OK: 0,
  GENERIC: 1,
  USAGE: 2,
  ENV: 3,
  GIT: 4,
  REGISTER: 5,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

export class RaygetError extends Error {
  readonly code: ExitCode;

  constructor(code: ExitCode, message: string) {
    super(message);
    this.name = "RaygetError";
    this.code = code;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/errors.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/errors.ts test/errors.test.ts
git commit -m "feat: add RaygetError and exit code table"
```

---

## Task 3: URL parser

**Files:**
- Create: `src/url-parse.ts`
- Test: `test/url-parse.test.ts`

The parser turns any accepted input into a `ParsedSource` and derives the stable
`id`, the clone URL, and the web URL. Accepted forms (spec §5):
`https://github.com/owner/repo`, `.../tree/<ref>/<subdir...>`, `owner/repo`
shorthand, with `--ref`/`--path` overrides.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/url-parse.test.ts`
Expected: FAIL — cannot find module `../src/url-parse.js`.

- [ ] **Step 3: Write `src/url-parse.ts`**

```ts
import { EXIT, RaygetError } from "./errors.js";

export interface ParsedSource {
  host: string;
  owner: string;
  repo: string;
  ref?: string;
  subdir?: string;
}

export interface SourceOverrides {
  ref?: string;
  path?: string;
}

const SEGMENT = /^[A-Za-z0-9._-]+$/;

function cleanRepo(repo: string): string {
  return repo.replace(/\.git$/, "");
}

export function parseSource(input: string, overrides: SourceOverrides = {}): ParsedSource {
  const trimmed = input.trim().replace(/\/+$/, "");
  let host = "github.com";
  let rest = trimmed;

  const urlMatch = trimmed.match(/^https?:\/\/([^/]+)\/(.+)$/);
  if (urlMatch) {
    host = urlMatch[1]!;
    rest = urlMatch[2]!;
  }

  const parts = rest.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new RaygetError(EXIT.USAGE, `cannot parse source: ${input}`);
  }

  const owner = parts[0]!;
  const repo = cleanRepo(parts[1]!);
  let ref: string | undefined;
  let subdir: string | undefined;

  if (parts[2] === "tree" && parts.length >= 4) {
    ref = parts[3];
    const sub = parts.slice(4).join("/");
    subdir = sub.length > 0 ? sub : undefined;
  } else if (parts.length > 2) {
    throw new RaygetError(EXIT.USAGE, `cannot parse source: ${input}`);
  }

  if (!SEGMENT.test(owner) || !SEGMENT.test(repo)) {
    throw new RaygetError(EXIT.USAGE, `cannot parse source: ${input}`);
  }

  if (overrides.ref) ref = overrides.ref;
  if (overrides.path) subdir = overrides.path.replace(/^\/+|\/+$/g, "");

  return { host, owner, repo, ref, subdir };
}

export function sourceId(p: ParsedSource): string {
  return p.subdir ? `${p.owner}/${p.repo}/${p.subdir}` : `${p.owner}/${p.repo}`;
}

export function cloneUrl(p: ParsedSource): string {
  return `https://${p.host}/${p.owner}/${p.repo}.git`;
}

export function webUrl(p: ParsedSource): string {
  return `https://${p.host}/${p.owner}/${p.repo}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/url-parse.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/url-parse.ts test/url-parse.test.ts
git commit -m "feat: parse GitHub URLs and shorthand into a source descriptor"
```

---

## Task 4: Paths and cellar naming

**Files:**
- Create: `src/paths.ts`
- Test: `test/paths.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/paths.test.ts`
Expected: FAIL — cannot find module `../src/paths.js`.

- [ ] **Step 3: Write `src/paths.ts`**

```ts
import { homedir } from "node:os";
import { join } from "node:path";
import type { ParsedSource } from "./url-parse.js";

export interface Paths {
  root: string;
  cellar: string;
  manifest: string;
  log: string;
}

export function raygetPaths(home: string = homedir()): Paths {
  const root = join(home, ".rayget");
  return {
    root,
    cellar: join(root, "cellar"),
    manifest: join(root, "manifest.json"),
    log: join(root, "rayget.log"),
  };
}

export function cellarDirName(p: ParsedSource): string {
  const base = `${p.owner}__${p.repo}`;
  if (!p.subdir) return base;
  return `${base}__${p.subdir.replace(/\//g, "_")}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/paths.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/paths.ts test/paths.test.ts
git commit -m "feat: resolve ~/.rayget paths and cellar directory names"
```

---

## Task 5: Manifest read/write/migrate

**Files:**
- Create: `src/manifest.ts`
- Test: `test/manifest.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type ExtensionEntry,
  emptyManifest,
  readManifest,
  removeEntry,
  upsertEntry,
  writeManifest,
} from "../src/manifest.js";

function tmpFile(): string {
  const dir = mkdtempSync(join(tmpdir(), "rayget-"));
  return join(dir, "manifest.json");
}

const sample: ExtensionEntry = {
  id: "owner/repo",
  name: "wandb",
  title: "Weights & Biases",
  url: "https://github.com/owner/repo",
  ref: "master",
  commit: "e27838d",
  path: "cellar/owner__repo",
  extensionRoot: ".",
  installedAt: "2026-06-05T00:00:00.000Z",
  updatedAt: "2026-06-05T00:00:00.000Z",
};

describe("manifest", () => {
  it("returns an empty manifest when the file is missing", () => {
    const m = readManifest(tmpFile());
    expect(m).toEqual(emptyManifest());
    expect(m.version).toBe(1);
  });

  it("round-trips through write and read", () => {
    const file = tmpFile();
    writeManifest(file, upsertEntry(emptyManifest(), sample));
    const m = readManifest(file);
    expect(m.extensions["owner/repo"]).toEqual(sample);
  });

  it("upsert replaces an existing entry by id", () => {
    let m = upsertEntry(emptyManifest(), sample);
    m = upsertEntry(m, { ...sample, commit: "abc1234" });
    expect(Object.keys(m.extensions)).toHaveLength(1);
    expect(m.extensions["owner/repo"]!.commit).toBe("abc1234");
  });

  it("removeEntry drops an entry", () => {
    const m = removeEntry(upsertEntry(emptyManifest(), sample), "owner/repo");
    expect(m.extensions).toEqual({});
  });

  it("migrates an unversioned legacy file to version 1", () => {
    const file = tmpFile();
    writeFileSync(file, JSON.stringify({ extensions: {} }));
    expect(readManifest(file).version).toBe(1);
  });

  it("writes pretty JSON ending in a newline", () => {
    const file = tmpFile();
    writeManifest(file, emptyManifest());
    const raw = readFileSync(file, "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw).toContain("\n  ");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/manifest.test.ts`
Expected: FAIL — cannot find module `../src/manifest.js`.

- [ ] **Step 3: Write `src/manifest.ts`**

```ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const MANIFEST_VERSION = 1;

export interface ExtensionEntry {
  id: string;
  name: string;
  title: string;
  url: string;
  ref: string;
  commit: string;
  path: string;
  extensionRoot: string;
  installedAt: string;
  updatedAt: string;
}

export interface Manifest {
  version: number;
  extensions: Record<string, ExtensionEntry>;
}

export function emptyManifest(): Manifest {
  return { version: MANIFEST_VERSION, extensions: {} };
}

export function readManifest(file: string): Manifest {
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return emptyManifest();
  }
  const parsed = JSON.parse(raw) as Partial<Manifest>;
  return {
    version: MANIFEST_VERSION,
    extensions: parsed.extensions ?? {},
  };
}

export function writeManifest(file: string, manifest: Manifest): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
}

export function upsertEntry(manifest: Manifest, entry: ExtensionEntry): Manifest {
  return {
    ...manifest,
    extensions: { ...manifest.extensions, [entry.id]: entry },
  };
}

export function removeEntry(manifest: Manifest, id: string): Manifest {
  const next = { ...manifest.extensions };
  delete next[id];
  return { ...manifest, extensions: next };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/manifest.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/manifest.ts test/manifest.test.ts
git commit -m "feat: manifest registry read/write/migrate with upsert and remove"
```

---

## Task 6: Cellar — extension-root detection and git/npm wrappers

**Files:**
- Create: `src/cellar.ts`
- Test: `test/cellar.test.ts`
- Create fixtures: `test/fixtures/single/package.json`, `test/fixtures/mono/packages/ext/package.json`, `test/fixtures/none/package.json`

The pure, tested pieces are `isRaycastManifest`, `readPackageJson`, and
`locateExtensionRoot`. The git/npm functions are thin `execa` wrappers (exercised
later by the integration smoke test); they are written here but not unit-tested.

- [ ] **Step 1: Create fixture trees**

`test/fixtures/single/package.json`:
```json
{
  "$schema": "https://www.raycast.com/schemas/extension.json",
  "name": "single-ext",
  "title": "Single Ext",
  "commands": [{ "name": "index", "title": "Index", "mode": "view" }]
}
```

`test/fixtures/mono/packages/ext/package.json`:
```json
{
  "$schema": "https://www.raycast.com/schemas/extension.json",
  "name": "mono-ext",
  "title": "Mono Ext",
  "commands": [{ "name": "index", "title": "Index", "mode": "view" }]
}
```

`test/fixtures/none/package.json`:
```json
{
  "name": "not-an-extension",
  "version": "1.0.0"
}
```

- [ ] **Step 2: Write the failing test**

```ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/cellar.test.ts`
Expected: FAIL — cannot find module `../src/cellar.js`.

- [ ] **Step 4: Write `src/cellar.ts`**

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execa } from "execa";
import { EXIT, RaygetError } from "./errors.js";

export interface PackageJson {
  name?: string;
  title?: string;
  $schema?: string;
  commands?: unknown[];
  [key: string]: unknown;
}

export function isRaycastManifest(pkg: unknown): boolean {
  if (typeof pkg !== "object" || pkg === null) return false;
  const p = pkg as PackageJson;
  const schemaOk = typeof p.$schema === "string" && p.$schema.includes("extension.json");
  const commandsOk = Array.isArray(p.commands) && p.commands.length > 0;
  return schemaOk && commandsOk;
}

export function readPackageJson(dir: string): PackageJson {
  const file = join(dir, "package.json");
  return JSON.parse(readFileSync(file, "utf8")) as PackageJson;
}

export function locateExtensionRoot(cloneDir: string, subdir?: string): string {
  const candidate = subdir ? join(cloneDir, subdir) : cloneDir;
  const pkgPath = join(candidate, "package.json");
  if (existsSync(pkgPath) && isRaycastManifest(readPackageJson(candidate))) {
    return candidate;
  }
  throw new RaygetError(
    EXIT.GENERIC,
    subdir
      ? `no Raycast extension manifest found at ${candidate} (check --path)`
      : `no Raycast extension manifest found at the repo root (use --path for a monorepo subdir)`,
  );
}

// --- git / npm shell-outs (thin wrappers; covered by the integration smoke test) ---

async function git(args: string[], cwd?: string): Promise<string> {
  try {
    const { stdout } = await execa("git", args, cwd ? { cwd } : {});
    return stdout.trim();
  } catch (err) {
    throw new RaygetError(EXIT.GIT, `git ${args.join(" ")} failed: ${(err as Error).message}`);
  }
}

export async function gitClone(url: string, dest: string): Promise<void> {
  await git(["clone", url, dest]);
}

export async function gitCheckout(repoDir: string, ref: string): Promise<void> {
  await git(["checkout", ref], repoDir);
}

export async function gitCurrentBranch(repoDir: string): Promise<string> {
  return git(["rev-parse", "--abbrev-ref", "HEAD"], repoDir);
}

export async function gitRevParse(repoDir: string): Promise<string> {
  return git(["rev-parse", "HEAD"], repoDir);
}

export async function gitFetch(repoDir: string): Promise<void> {
  await git(["fetch", "--all", "--tags", "--prune"], repoDir);
}

/** Move the working tree to the latest commit of `ref` (branch or tag/sha). */
export async function gitUpdateTo(repoDir: string, ref: string): Promise<void> {
  await git(["checkout", ref], repoDir);
  // Best-effort fast-forward for branches; harmless/no-op for detached tags.
  try {
    await git(["merge", "--ff-only", `origin/${ref}`], repoDir);
  } catch {
    /* ref is a tag or sha with no matching remote branch — leave as checked out */
  }
}

export async function gitRemoteCommit(repoDir: string, ref: string): Promise<string> {
  const out = await git(["ls-remote", "origin", ref], repoDir);
  const first = out.split("\n")[0] ?? "";
  return first.split(/\s+/)[0] ?? "";
}

export async function npmInstall(extensionRoot: string): Promise<void> {
  const useCi = existsSync(join(extensionRoot, "package-lock.json"));
  try {
    await execa("npm", [useCi ? "ci" : "install"], { cwd: extensionRoot });
  } catch (err) {
    throw new RaygetError(
      EXIT.GENERIC,
      `npm ${useCi ? "ci" : "install"} failed: ${(err as Error).message}`,
    );
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/cellar.test.ts`
Expected: PASS (root detection + manifest checks).

- [ ] **Step 6: Commit**

```bash
git add src/cellar.ts test/cellar.test.ts test/fixtures
git commit -m "feat: extension-root detection and git/npm cellar helpers"
```

---

## Task 7: Registrar — spawn `npx ray develop`, watch, SIGINT on success

**Files:**
- Create: `src/registrar.ts`
- Test: `test/registrar.test.ts`

The registrar is the crux (spec §6). It depends on an injectable `spawner` so the
behavior (success-line detection, timeout, exit-before-success) is fully unit
tested without Raycast.

- [ ] **Step 1: Write the failing test**

```ts
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import {
  type ProcessSpawner,
  type RegistrationProcess,
  DEFAULT_SUCCESS_LINE,
  register,
} from "../src/registrar.js";

function fakeProcess(): RegistrationProcess & {
  emitLine: (l: string) => void;
  finish: (code: number | null) => void;
  killed: string[];
} {
  const lines = new EventEmitter();
  let resolveDone: (v: { exitCode: number | null }) => void;
  const done = new Promise<{ exitCode: number | null }>((r) => (resolveDone = r));
  const killed: string[] = [];
  return {
    onLine: (cb) => lines.on("line", cb),
    kill: (sig) => killed.push(sig),
    done,
    emitLine: (l) => lines.emit("line", l),
    finish: (code) => resolveDone({ exitCode: code }),
    killed,
  };
}

describe("register", () => {
  it("resolves and SIGINTs when the success line appears", async () => {
    const proc = fakeProcess();
    const spawner: ProcessSpawner = () => proc;
    const log = vi.fn();
    const p = register({ cwd: "/x", log, spawner });
    proc.emitLine("compiling…");
    proc.emitLine(`done — ${DEFAULT_SUCCESS_LINE}`);
    await expect(p).resolves.toBeUndefined();
    expect(proc.killed).toContain("SIGINT");
    expect(log).toHaveBeenCalledWith("compiling…");
  });

  it("rejects on timeout and hard-kills", async () => {
    vi.useFakeTimers();
    const proc = fakeProcess();
    const spawner: ProcessSpawner = () => proc;
    const p = register({ cwd: "/x", log: () => {}, spawner, timeoutMs: 1000 });
    const assertion = expect(p).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
    expect(proc.killed).toContain("SIGKILL");
    vi.useRealTimers();
  });

  it("resolves if the process exits 0 before a success line (ray build mode)", async () => {
    const proc = fakeProcess();
    const spawner: ProcessSpawner = () => proc;
    const p = register({ cwd: "/x", log: () => {}, spawner });
    proc.finish(0);
    await expect(p).resolves.toBeUndefined();
  });

  it("rejects if the process exits non-zero before a success line", async () => {
    const proc = fakeProcess();
    const spawner: ProcessSpawner = () => proc;
    const p = register({ cwd: "/x", log: () => {}, spawner });
    proc.finish(1);
    await expect(p).rejects.toThrow(/exited 1/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/registrar.test.ts`
Expected: FAIL — cannot find module `../src/registrar.js`.

- [ ] **Step 3: Write `src/registrar.ts`**

```ts
import readline from "node:readline";
import { execa } from "execa";
import { EXIT, RaygetError } from "./errors.js";

export const DEFAULT_SUCCESS_LINE = "built extension successfully";
export const DEFAULT_TIMEOUT_MS = 180_000;

export interface RegistrationProcess {
  onLine(cb: (line: string) => void): void;
  kill(signal: NodeJS.Signals): void;
  done: Promise<{ exitCode: number | null }>;
}

export type ProcessSpawner = (cmd: string, args: string[], cwd: string) => RegistrationProcess;

export const execaSpawner: ProcessSpawner = (cmd, args, cwd) => {
  const child = execa(cmd, args, { cwd, all: true, reject: false });
  const emit = (cb: (line: string) => void) => {
    if (child.all) {
      readline.createInterface({ input: child.all }).on("line", cb);
    }
  };
  return {
    onLine: emit,
    kill: (signal) => {
      child.kill(signal);
    },
    done: child.then((r) => ({ exitCode: r.exitCode ?? null })),
  };
};

export interface RegisterOptions {
  cwd: string;
  log: (line: string) => void;
  spawner?: ProcessSpawner;
  successLine?: string;
  timeoutMs?: number;
}

export function register(opts: RegisterOptions): Promise<void> {
  const spawner = opts.spawner ?? execaSpawner;
  const successLine = opts.successLine ?? DEFAULT_SUCCESS_LINE;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const proc = spawner("npx", ["ray", "develop"], opts.cwd);

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      finish(() => {
        proc.kill("SIGKILL");
        reject(new RaygetError(EXIT.REGISTER, `registration timed out after ${timeoutMs}ms`));
      });
    }, timeoutMs);

    proc.onLine((line) => {
      opts.log(line);
      if (!settled && line.includes(successLine)) {
        finish(() => {
          proc.kill("SIGINT");
          resolve();
        });
      }
    });

    proc.done
      .then(({ exitCode }) => {
        finish(() => {
          if (exitCode === 0 || exitCode === null) resolve();
          else
            reject(
              new RaygetError(EXIT.REGISTER, `ray exited ${exitCode} before registering`),
            );
        });
      })
      .catch((err: unknown) => {
        finish(() => reject(new RaygetError(EXIT.REGISTER, String(err))));
      });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/registrar.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/registrar.ts test/registrar.test.ts
git commit -m "feat: registrar spawns ray develop and resolves on success line"
```

---

## Task 8: Environment checks (doctor) + pre-flight

**Files:**
- Create: `src/env.ts`
- Test: `test/env.test.ts`

`runDoctor` produces a list of `CheckResult`. A `Runner` (injectable) wraps the
commands so the parse/aggregation logic is testable without a real environment.
`assertReadyToRegister` reuses the Raycast-running check as the registration
pre-flight (spec §6). Note: `ray login` state cannot be reliably detected
programmatically (an M1 open item), so it is reported as an informational
reminder, never a hard failure.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { type Runner, runDoctor, summarize } from "../src/env.js";

const allGood: Runner = {
  async which(bin) {
    return `/usr/bin/${bin}`;
  },
  async version() {
    return "v24.2.0";
  },
  async raycastRunning() {
    return true;
  },
  raycastInstalled() {
    return true;
  },
  writable() {
    return true;
  },
};

describe("runDoctor", () => {
  it("reports all checks ok in a healthy environment", async () => {
    const results = await runDoctor(allGood);
    const names = results.map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining(["node", "npm", "git", "raycast", "~/.rayget"]),
    );
    expect(results.filter((r) => r.name !== "ray login").every((r) => r.ok)).toBe(true);
  });

  it("flags a missing binary with an actionable fix", async () => {
    const noNode: Runner = { ...allGood, async which(bin) {
      if (bin === "node") return null;
      return `/usr/bin/${bin}`;
    } };
    const results = await runDoctor(noNode);
    const node = results.find((r) => r.name === "node")!;
    expect(node.ok).toBe(false);
    expect(node.fix).toMatch(/install node/i);
  });

  it("flags Raycast not running", async () => {
    const notRunning: Runner = { ...allGood, async raycastRunning() {
      return false;
    } };
    const raycast = (await runDoctor(notRunning)).find((r) => r.name === "raycast")!;
    expect(raycast.ok).toBe(false);
  });

  it("summarize is true only when every non-informational check passes", async () => {
    expect(summarize(await runDoctor(allGood))).toBe(true);
    const noGit: Runner = { ...allGood, async which(bin) {
      if (bin === "git") return null;
      return `/usr/bin/${bin}`;
    } };
    expect(summarize(await runDoctor(noGit))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/env.test.ts`
Expected: FAIL — cannot find module `../src/env.js`.

- [ ] **Step 3: Write `src/env.ts`**

```ts
import { accessSync, constants, existsSync, mkdirSync } from "node:fs";
import { execa } from "execa";
import { EXIT, RaygetError } from "./errors.js";
import { raygetPaths } from "./paths.js";

export interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
  fix?: string;
  informational?: boolean;
}

export interface Runner {
  which(bin: string): Promise<string | null>;
  version(bin: string, arg: string): Promise<string | null>;
  raycastRunning(): Promise<boolean>;
  raycastInstalled(): boolean;
  writable(dir: string): boolean;
}

export const realRunner: Runner = {
  async which(bin) {
    try {
      const { stdout } = await execa("which", [bin]);
      return stdout.trim() || null;
    } catch {
      return null;
    }
  },
  async version(bin, arg) {
    try {
      const { stdout } = await execa(bin, [arg]);
      return stdout.trim();
    } catch {
      return null;
    }
  },
  async raycastRunning() {
    try {
      await execa("pgrep", ["-x", "Raycast"]);
      return true;
    } catch {
      return false;
    }
  },
  raycastInstalled() {
    return existsSync("/Applications/Raycast.app");
  },
  writable(dir) {
    try {
      mkdirSync(dir, { recursive: true });
      accessSync(dir, constants.W_OK);
      return true;
    } catch {
      return false;
    }
  },
};

async function checkBin(run: Runner, bin: string, versionArg: string): Promise<CheckResult> {
  const path = await run.which(bin);
  if (!path) {
    return {
      name: bin,
      ok: false,
      detail: "not found on PATH",
      fix: `install ${bin} (e.g. \`brew install ${bin === "npm" ? "node" : bin}\`)`,
    };
  }
  const version = await run.version(bin, versionArg);
  return { name: bin, ok: true, detail: `${path}${version ? ` (${version})` : ""}` };
}

export async function runDoctor(run: Runner = realRunner): Promise<CheckResult[]> {
  const paths = raygetPaths();
  const results: CheckResult[] = [];

  results.push(await checkBin(run, "node", "--version"));
  results.push(await checkBin(run, "npm", "--version"));
  results.push(await checkBin(run, "git", "--version"));

  const installed = run.raycastInstalled();
  const running = installed ? await run.raycastRunning() : false;
  results.push({
    name: "raycast",
    ok: installed && running,
    detail: !installed
      ? "Raycast.app not found in /Applications"
      : running
        ? "installed and running"
        : "installed but not running",
    fix: !installed
      ? "install Raycast from https://raycast.com"
      : running
        ? undefined
        : "launch the Raycast app",
  });

  results.push({
    name: "ray login",
    ok: true,
    informational: true,
    detail: "cannot be auto-detected — ensure you ran `ray login` (free account)",
  });

  const writable = run.writable(paths.root);
  results.push({
    name: "~/.rayget",
    ok: writable,
    detail: writable ? `writable (${paths.root})` : `not writable (${paths.root})`,
    fix: writable ? undefined : `check permissions on ${paths.root}`,
  });

  return results;
}

export function summarize(results: CheckResult[]): boolean {
  return results.filter((r) => !r.informational).every((r) => r.ok);
}

/** Pre-flight for registration (spec §6): Raycast must be running. */
export async function assertReadyToRegister(run: Runner = realRunner): Promise<void> {
  if (!run.raycastInstalled()) {
    throw new RaygetError(EXIT.ENV, "Raycast is not installed — install it from https://raycast.com");
  }
  if (!(await run.raycastRunning())) {
    throw new RaygetError(EXIT.ENV, "Raycast app is not running — launch it, then retry");
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/env.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/env.ts test/env.test.ts
git commit -m "feat: doctor environment checks and registration pre-flight"
```

---

## Task 9: Output layer and logger

**Files:**
- Create: `src/output.ts`
- Create: `src/log.ts`
- Test: `test/log.test.ts`

- [ ] **Step 1: Write the failing test for the logger**

```ts
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createLogger } from "../src/log.js";

describe("createLogger", () => {
  it("appends lines and tails the last N", () => {
    const file = join(mkdtempSync(join(tmpdir(), "rayget-log-")), "rayget.log");
    const logger = createLogger(file);
    for (let i = 1; i <= 5; i++) logger.log(`line ${i}`);
    expect(readFileSync(file, "utf8")).toContain("line 5");
    expect(logger.tail(2).trim().split("\n")).toEqual(["line 4", "line 5"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/log.test.ts`
Expected: FAIL — cannot find module `../src/log.js`.

- [ ] **Step 3: Write `src/log.ts`**

```ts
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

export interface Logger {
  log(line: string): void;
  tail(n: number): string;
}

export function createLogger(file: string): Logger {
  mkdirSync(dirname(file), { recursive: true });
  return {
    log(line: string) {
      appendFileSync(file, `${line}\n`);
    },
    tail(n: number): string {
      let raw = "";
      try {
        raw = readFileSync(file, "utf8");
      } catch {
        return "";
      }
      const lines = raw.split("\n").filter((l) => l.length > 0);
      return lines.slice(-n).join("\n");
    },
  };
}
```

- [ ] **Step 4: Write `src/output.ts`** (no dedicated unit test — exercised via commands)

```ts
import chalk from "chalk";

export interface OutputOptions {
  json: boolean;
}

export function printResult(data: unknown, human: () => void, opts: OutputOptions): void {
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  } else {
    human();
  }
}

export function printError(err: unknown, opts: OutputOptions): void {
  const message = err instanceof Error ? err.message : String(err);
  if (opts.json) {
    process.stderr.write(`${JSON.stringify({ error: message }, null, 2)}\n`);
  } else {
    process.stderr.write(`${chalk.red("error:")} ${message}\n`);
  }
}

export function info(message: string, opts: OutputOptions): void {
  if (!opts.json) process.stdout.write(`${message}\n`);
}

export function printTable(rows: Array<Record<string, string>>, opts: OutputOptions): void {
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
    return;
  }
  if (rows.length === 0) {
    process.stdout.write("no extensions installed\n");
    return;
  }
  const cols = Object.keys(rows[0]!);
  const widths = cols.map((c) => Math.max(c.length, ...rows.map((r) => (r[c] ?? "").length)));
  const fmt = (cells: string[]) =>
    cells.map((cell, i) => cell.padEnd(widths[i]!)).join("  ");
  process.stdout.write(`${chalk.bold(fmt(cols))}\n`);
  for (const r of rows) process.stdout.write(`${fmt(cols.map((c) => r[c] ?? ""))}\n`);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/log.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/log.ts src/output.ts test/log.test.ts
git commit -m "feat: output layer (human/JSON/table) and rayget.log logger"
```

---

## Task 10: `add` command

**Files:**
- Create: `src/commands/add.ts`

Orchestration only — every pure piece it calls is already tested. Exercised
end-to-end by the integration smoke test (Task 16, opt-in).

- [ ] **Step 1: Write `src/commands/add.ts`**

```ts
import { mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import {
  gitCheckout,
  gitClone,
  gitCurrentBranch,
  gitRevParse,
  locateExtensionRoot,
  npmInstall,
  readPackageJson,
} from "../cellar.js";
import { assertReadyToRegister } from "../env.js";
import { EXIT, RaygetError } from "../errors.js";
import { createLogger } from "../log.js";
import { type ExtensionEntry, readManifest, upsertEntry, writeManifest } from "../manifest.js";
import { type OutputOptions, info, printResult } from "../output.js";
import { cellarDirName, raygetPaths } from "../paths.js";
import { register } from "../registrar.js";
import { cloneUrl, parseSource, sourceId, webUrl } from "../url-parse.js";

export interface AddArgs {
  url: string;
  ref?: string;
  path?: string;
}

export async function cmdAdd(args: AddArgs, opts: OutputOptions): Promise<void> {
  const parsed = parseSource(args.url, { ref: args.ref, path: args.path });
  const id = sourceId(parsed);
  const paths = raygetPaths();
  const manifest = readManifest(paths.manifest);

  if (manifest.extensions[id]) {
    throw new RaygetError(
      EXIT.USAGE,
      `already installed: ${id} — use \`rayget upgrade ${id}\` to update it`,
    );
  }

  mkdirSync(paths.cellar, { recursive: true });
  const dirName = cellarDirName(parsed);
  const cloneDir = join(paths.cellar, dirName);

  info(`Cloning ${cloneUrl(parsed)} …`, opts);
  await gitClone(cloneUrl(parsed), cloneDir);
  if (parsed.ref) await gitCheckout(cloneDir, parsed.ref);

  const root = locateExtensionRoot(cloneDir, parsed.subdir);
  const pkg = readPackageJson(root);

  info("Installing dependencies …", opts);
  await npmInstall(root);

  await assertReadyToRegister();
  info("Registering with Raycast …", opts);
  const logger = createLogger(paths.log);
  await register({ cwd: root, log: logger.log });

  const ref = parsed.ref ?? (await gitCurrentBranch(cloneDir));
  const commit = await gitRevParse(cloneDir);
  const now = new Date().toISOString();
  const extensionRoot = relative(cloneDir, root) || ".";

  const entry: ExtensionEntry = {
    id,
    name: pkg.name ?? parsed.repo,
    title: pkg.title ?? pkg.name ?? parsed.repo,
    url: webUrl(parsed),
    ref,
    commit,
    path: `cellar/${dirName}`,
    extensionRoot,
    installedAt: now,
    updatedAt: now,
  };

  writeManifest(paths.manifest, upsertEntry(manifest, entry));

  printResult(
    entry,
    () => {
      info(`\nInstalled ${entry.title} (${id}) @ ${commit.slice(0, 7)}`, opts);
      info(`Source: ${entry.url}`, opts);
      info("Now searchable in Raycast.", opts);
    },
    opts,
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0, no output.

- [ ] **Step 3: Commit**

```bash
git add src/commands/add.ts
git commit -m "feat: add command (clone, install, register, record)"
```

---

## Task 11: `list` command

**Files:**
- Create: `src/commands/list.ts`

- [ ] **Step 1: Write `src/commands/list.ts`**

```ts
import { join } from "node:path";
import { gitRemoteCommit } from "../cellar.js";
import { type ExtensionEntry, readManifest } from "../manifest.js";
import { type OutputOptions, printTable } from "../output.js";
import { raygetPaths } from "../paths.js";

export interface ListArgs {
  offline: boolean;
}

async function updateStatus(
  entry: ExtensionEntry,
  rootDir: string,
  offline: boolean,
): Promise<string> {
  if (offline) return "?";
  try {
    const remote = await gitRemoteCommit(join(rootDir, entry.path), entry.ref);
    if (!remote) return "?";
    return remote.startsWith(entry.commit) || entry.commit.startsWith(remote)
      ? "up-to-date"
      : "update available";
  } catch {
    return "?";
  }
}

export async function cmdList(args: ListArgs, opts: OutputOptions): Promise<void> {
  const paths = raygetPaths();
  const manifest = readManifest(paths.manifest);
  const entries = Object.values(manifest.extensions);

  const rows = await Promise.all(
    entries.map(async (e) => ({
      id: e.id,
      title: e.title,
      ref: e.ref,
      commit: e.commit.slice(0, 7),
      installed: e.installedAt.slice(0, 10),
      update: await updateStatus(e, paths.root, args.offline),
    })),
  );

  printTable(rows, opts);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/commands/list.ts
git commit -m "feat: list command with update-available detection"
```

---

## Task 12: `doctor` command

**Files:**
- Create: `src/commands/doctor.ts`

- [ ] **Step 1: Write `src/commands/doctor.ts`**

```ts
import chalk from "chalk";
import { runDoctor, summarize } from "../env.js";
import { EXIT } from "../errors.js";
import { type OutputOptions, printResult } from "../output.js";

export async function cmdDoctor(opts: OutputOptions): Promise<number> {
  const results = await runDoctor();
  const healthy = summarize(results);

  printResult(
    { healthy, checks: results },
    () => {
      for (const r of results) {
        const mark = r.informational ? chalk.yellow("•") : r.ok ? chalk.green("✓") : chalk.red("✗");
        process.stdout.write(`${mark} ${r.name}: ${r.detail}\n`);
        if (!r.ok && r.fix) process.stdout.write(`    → ${r.fix}\n`);
      }
      process.stdout.write(
        healthy ? chalk.green("\nAll required checks passed.\n") : chalk.red("\nSome checks failed.\n"),
      );
    },
    opts,
  );

  return healthy ? EXIT.OK : EXIT.ENV;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/commands/doctor.ts
git commit -m "feat: doctor command reporting environment health"
```

---

## Task 13: CLI dispatch, help, version

**Files:**
- Modify: `src/cli.ts` (replace placeholder)

Wires arg parsing (via `node:util` `parseArgs`) to the commands, resolves output
format (`--json` flag, or auto when stdout is not a TTY), and maps `RaygetError`
to the right exit code. `remove`/`upgrade` are added in M3 (Tasks 14–15) — the
dispatch includes their cases now, importing modules created there.

- [ ] **Step 1: Replace `src/cli.ts`**

```ts
#!/usr/bin/env node
import { parseArgs } from "node:util";
import { cmdAdd } from "./commands/add.js";
import { cmdDoctor } from "./commands/doctor.js";
import { cmdList } from "./commands/list.js";
import { cmdRemove } from "./commands/remove.js";
import { cmdUpgrade } from "./commands/upgrade.js";
import { EXIT, RaygetError } from "./errors.js";
import { type OutputOptions, printError } from "./output.js";

const VERSION = "0.1.0";

const HELP = `rayget — install & manage unpublished Raycast extensions from GitHub

Usage:
  rayget add <github-url> [--ref <branch|tag|sha>] [--path <subdir>]
  rayget list [--offline]
  rayget upgrade [<id> | --all]
  rayget remove <id>
  rayget doctor
  rayget --help | --version

Global flags:
  --json     machine-readable output (auto when stdout is not a TTY)
`;

function resolveJson(flag: boolean | undefined): boolean {
  return flag ?? !process.stdout.isTTY;
}

async function run(): Promise<number> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    strict: false,
    options: {
      help: { type: "boolean" },
      version: { type: "boolean" },
      json: { type: "boolean" },
      offline: { type: "boolean" },
      all: { type: "boolean" },
      ref: { type: "string" },
      path: { type: "string" },
    },
  });

  if (values.version) {
    process.stdout.write(`${VERSION}\n`);
    return EXIT.OK;
  }

  const command = positionals[0];
  if (!command || values.help) {
    process.stdout.write(HELP);
    return command ? EXIT.OK : values.help ? EXIT.OK : EXIT.USAGE;
  }

  const opts: OutputOptions = { json: resolveJson(values.json as boolean | undefined) };

  switch (command) {
    case "add": {
      const url = positionals[1];
      if (!url) throw new RaygetError(EXIT.USAGE, "add requires a <github-url>");
      await cmdAdd(
        { url, ref: values.ref as string | undefined, path: values.path as string | undefined },
        opts,
      );
      return EXIT.OK;
    }
    case "list":
      await cmdList({ offline: Boolean(values.offline) }, opts);
      return EXIT.OK;
    case "upgrade":
      await cmdUpgrade(
        { id: positionals[1], all: Boolean(values.all) },
        opts,
      );
      return EXIT.OK;
    case "remove": {
      const id = positionals[1];
      if (!id) throw new RaygetError(EXIT.USAGE, "remove requires an <id>");
      await cmdRemove({ id }, opts);
      return EXIT.OK;
    }
    case "doctor":
      return cmdDoctor(opts);
    default:
      throw new RaygetError(EXIT.USAGE, `unknown command: ${command}`);
  }
}

run()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    const json = process.argv.includes("--json") || !process.stdout.isTTY;
    printError(err, { json });
    process.exit(err instanceof RaygetError ? err.code : EXIT.GENERIC);
  });
```

- [ ] **Step 2: Note** — this file imports `./commands/remove.js` and `./commands/upgrade.js`, which are created in Tasks 14–15. Do this task **after** Tasks 14–15, or stub those two modules first. Recommended order: Task 14 → Task 15 → Task 13.

- [ ] **Step 3: Build and smoke-test help/version**

Run: `npm run build && node dist/cli.js --version && node dist/cli.js --help && node dist/cli.js doctor --json`
Expected: prints `0.1.0`, the help text, and a JSON doctor report.

- [ ] **Step 4: Commit**

```bash
git add src/cli.ts
git commit -m "feat: CLI dispatch with help, version, and format resolution"
```

---

# Milestone M3 — Lifecycle (remove, upgrade)

## Task 14: `remove` command

**Files:**
- Create: `src/commands/remove.ts`

Implements spec §7 option 2: best-effort local removal + guided GUI step (there
is no `ray uninstall`).

- [ ] **Step 1: Write `src/commands/remove.ts`**

```ts
import { rmSync } from "node:fs";
import { join } from "node:path";
import { EXIT, RaygetError } from "../errors.js";
import { readManifest, removeEntry, writeManifest } from "../manifest.js";
import { type OutputOptions, info, printResult } from "../output.js";
import { raygetPaths } from "../paths.js";

export interface RemoveArgs {
  id: string;
}

export async function cmdRemove(args: RemoveArgs, opts: OutputOptions): Promise<void> {
  const paths = raygetPaths();
  const manifest = readManifest(paths.manifest);
  const entry = manifest.extensions[args.id];

  if (!entry) {
    throw new RaygetError(EXIT.USAGE, `not installed: ${args.id} (see \`rayget list\`)`);
  }

  rmSync(join(paths.root, entry.path), { recursive: true, force: true });
  writeManifest(paths.manifest, removeEntry(manifest, args.id));

  printResult(
    { removed: args.id, title: entry.title, guiStepRequired: true },
    () => {
      info(`Removed ${entry.title} (${args.id}) from rayget.`, opts);
      info("", opts);
      info("Raycast keeps a registration for local extensions. To fully remove it:", opts);
      info(`  Raycast → Settings → Extensions → ${entry.title} → Remove`, opts);
    },
    opts,
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0 (will also need Task 15's `upgrade.ts` and Task 13's `cli.ts` to fully typecheck; run after those or expect only the cli import to be unresolved).

- [ ] **Step 3: Commit**

```bash
git add src/commands/remove.ts
git commit -m "feat: remove command (delete cellar + manifest entry, guide GUI unregister)"
```

---

## Task 15: `upgrade` command

**Files:**
- Create: `src/commands/upgrade.ts`

- [ ] **Step 1: Write `src/commands/upgrade.ts`**

```ts
import { join } from "node:path";
import {
  gitFetch,
  gitRevParse,
  gitUpdateTo,
  locateExtensionRoot,
  npmInstall,
} from "../cellar.js";
import { assertReadyToRegister } from "../env.js";
import { EXIT, RaygetError } from "../errors.js";
import { createLogger } from "../log.js";
import { type ExtensionEntry, readManifest, upsertEntry, writeManifest } from "../manifest.js";
import { type OutputOptions, info, printResult } from "../output.js";
import { raygetPaths } from "../paths.js";
import { register } from "../registrar.js";

export interface UpgradeArgs {
  id?: string;
  all: boolean;
}

interface UpgradeResult {
  id: string;
  from: string;
  to: string;
  changed: boolean;
}

async function upgradeOne(
  entry: ExtensionEntry,
  rootDir: string,
  logFile: string,
  opts: OutputOptions,
): Promise<UpgradeResult> {
  const cloneDir = join(rootDir, entry.path);
  info(`Fetching ${entry.id} …`, opts);
  await gitFetch(cloneDir);
  await gitUpdateTo(cloneDir, entry.ref);

  const newCommit = await gitRevParse(cloneDir);
  if (newCommit === entry.commit) {
    info(`${entry.id} already up-to-date (${newCommit.slice(0, 7)})`, opts);
    return { id: entry.id, from: entry.commit, to: newCommit, changed: false };
  }

  const root = locateExtensionRoot(cloneDir, entry.extensionRoot === "." ? undefined : entry.extensionRoot);
  info("Installing dependencies …", opts);
  await npmInstall(root);

  await assertReadyToRegister();
  info("Re-registering with Raycast …", opts);
  await register({ cwd: root, log: createLogger(logFile).log });

  return { id: entry.id, from: entry.commit, to: newCommit, changed: true };
}

export async function cmdUpgrade(args: UpgradeArgs, opts: OutputOptions): Promise<void> {
  const paths = raygetPaths();
  let manifest = readManifest(paths.manifest);

  let targets: ExtensionEntry[];
  if (args.all) {
    targets = Object.values(manifest.extensions);
  } else if (args.id) {
    const entry = manifest.extensions[args.id];
    if (!entry) throw new RaygetError(EXIT.USAGE, `not installed: ${args.id}`);
    targets = [entry];
  } else {
    throw new RaygetError(EXIT.USAGE, "upgrade requires an <id> or --all");
  }

  const results: UpgradeResult[] = [];
  for (const entry of targets) {
    const result = await upgradeOne(entry, paths.root, paths.log, opts);
    results.push(result);
    if (result.changed) {
      manifest = upsertEntry(manifest, {
        ...entry,
        commit: result.to,
        updatedAt: new Date().toISOString(),
      });
      writeManifest(paths.manifest, manifest);
    }
  }

  printResult(
    { upgraded: results },
    () => {
      const changed = results.filter((r) => r.changed);
      info(
        changed.length === 0
          ? "Everything already up-to-date."
          : `Upgraded ${changed.length} extension(s).`,
        opts,
      );
    },
    opts,
  );
}
```

- [ ] **Step 2: Typecheck the whole project**

Run: `npm run typecheck && npm test`
Expected: typecheck exit 0; all unit tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/commands/upgrade.ts
git commit -m "feat: upgrade command (single + --all) with no-op detection"
```

---

## Task 16: End-to-end build + opt-in integration smoke test

**Files:**
- Create: `test/integration.test.ts`

This test is gated behind `RAYGET_E2E=1` because it needs Raycast running and
logged in (spec §10). It is skipped by default so CI stays green.

- [ ] **Step 1: Write `test/integration.test.ts`**

```ts
import { execa } from "execa";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, "..", "dist", "cli.js");
const run = process.env.RAYGET_E2E === "1" ? it : it.skip;

// Replace with a known-small public Raycast extension repo before running.
const SAMPLE_REPO = process.env.RAYGET_E2E_REPO ?? "raycast/extensions";

describe("integration (opt-in: RAYGET_E2E=1)", () => {
  run("adds, lists, and removes a real extension", async () => {
    await execa("node", [cli, "add", SAMPLE_REPO, "--json"]);
    const { stdout } = await execa("node", [cli, "list", "--json"]);
    expect(stdout).toContain(SAMPLE_REPO.split("/").slice(0, 2).join("/"));
    await execa("node", [cli, "remove", SAMPLE_REPO, "--json"]);
  }, 300_000);
});
```

- [ ] **Step 2: Verify it skips by default and the build runs**

Run: `npm run build && npm test`
Expected: build succeeds; integration test reported as skipped; all other tests pass.

- [ ] **Step 3: Commit**

```bash
git add test/integration.test.ts
git commit -m "test: opt-in end-to-end smoke test for add/list/remove"
```

---

# Milestone M4 — Polish

## Task 17: README usage docs + publish prep

**Files:**
- Modify: `README.md`
- Modify: `package.json` (add `repository`, `keywords`, `license`, `bin` already present)

- [ ] **Step 1: Append a Usage section to `README.md`**

```markdown
## Install

```bash
npm i -g rayget   # or: npx rayget <command>
```

## Usage

```bash
rayget add https://github.com/owner/repo          # install from a repo URL
rayget add owner/repo --ref v1.2.0                # pin a tag/branch/sha
rayget add owner/repo --path packages/ext         # monorepo subdir
rayget list [--offline]                           # show installed + update status
rayget upgrade <id> | --all                       # update to latest of the recorded ref
rayget remove <id>                                # remove locally (+ guided Raycast step)
rayget doctor                                     # check node/npm/git/Raycast/login
```

All commands accept `--json` for scripting (auto-enabled when piped).

## How it works

`rayget` clones each repo into `~/.rayget/cellar/`, runs `npm install`, and
registers the extension with the running Raycast app via `npx ray develop`
(terminated once it logs `built extension successfully`). Extensions installed
this way are *local/development* extensions and are never auto-updated by the
Store — `rayget upgrade` updates them on demand. See
[the design spec](docs/specs/2026-06-05-rayget-design.md).
```

- [ ] **Step 2: Add publish metadata to `package.json`**

Add these top-level fields:
```json
  "license": "MIT",
  "keywords": ["raycast", "cli", "extensions", "package-manager"],
  "repository": { "type": "git", "url": "git+https://github.com/oishikimchi97/rayget.git" }
```

- [ ] **Step 3: Verify the packed contents are correct**

Run: `npm run build && npm pack --dry-run`
Expected: the tarball lists `dist/**` and `package.json`/`README.md` only (no `src`, no `test`).

- [ ] **Step 4: Commit**

```bash
git add README.md package.json
git commit -m "docs: usage README and npm publish metadata"
```

---

## Open items deferred to M1 verification (spec §3, §6, §7)

These cannot be settled without a real Raycast session and are intentionally
left as the safe default in this plan; revisit after a manual spike:

1. **First-time registration:** the plan uses `npx ray develop` + SIGINT-on-success
   (proven). If a spike shows `npx ray build -e dev` registers first-time too,
   swap the spawn command/args in `registrar.ts` (the exit-0-resolves path is
   already in place) and drop the watch/kill.
2. **Removal:** ships GUI-guided (spec §7 option 2). If a `raycast://` deeplink
   for unregistering a dev extension is found, add it to `cmdRemove` before the
   GUI hint.
3. **`ray login` detection:** currently informational in `doctor`. If a reliable
   probe is found, upgrade it to a hard check and have `assertReadyToRegister`
   enforce it.

---

## Self-Review (against the spec)

- **§4 architecture / manifest shape** → Tasks 4, 5 (paths, manifest entry fields match exactly).
- **§5 `add`** (parse, clone, locate root, install, register, record, print) → Tasks 3, 6, 7, 10.
- **§5 `list`** (table + update-available + `--offline`) → Task 11.
- **§5 `upgrade`** (single + `--all`, no-op message) → Task 15.
- **§5 `remove`** (best-effort + GUI hint) → Task 14.
- **§5 `doctor`** (node/npm/git/Raycast/login/writable) → Tasks 8, 12.
- **§5 `--help`/`--version`** → Task 13.
- **§6 registration mechanism** (ray develop, success line, SIGINT, timeout, pre-flight) → Tasks 7, 8.
- **§7 removal strategy** (option 2) → Task 14 + Open items.
- **§8 tech stack** (TS, execa, chalk, minimal deps, single-responsibility modules) → Task 1 + module layout.
- **§9 error handling** (exit codes, log tail on failure, transactional add, `--json`) → Tasks 2, 9, 10, 13.
- **§10 testing** (URL parser, manifest, root detection, registrar mock, opt-in integration) → Tasks 3, 5, 6, 7, 16.
- **§11 milestones** → M2 (Tasks 1–13), M3 (Tasks 14–15), M4 (Tasks 16–17). M5 (taps) intentionally out of scope.

**Note on dispatch ordering:** `cli.ts` (Task 13) imports the `remove`/`upgrade`
modules (Tasks 14–15). Implement Tasks 14 and 15 before Task 13, or temporarily
stub the two imports. This is called out in Task 13 Step 2.
