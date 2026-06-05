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
    throw new RaygetError(
      EXIT.ENV,
      "Raycast is not installed — install it from https://raycast.com",
    );
  }
  if (!(await run.raycastRunning())) {
    throw new RaygetError(EXIT.ENV, "Raycast app is not running — launch it, then retry");
  }
}
