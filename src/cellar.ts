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
