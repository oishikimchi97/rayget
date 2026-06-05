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
