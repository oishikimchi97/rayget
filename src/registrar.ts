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
            reject(new RaygetError(EXIT.REGISTER, `ray exited ${exitCode} before registering`));
        });
      })
      .catch((err: unknown) => {
        finish(() => reject(new RaygetError(EXIT.REGISTER, String(err))));
      });
  });
}
