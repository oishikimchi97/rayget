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
