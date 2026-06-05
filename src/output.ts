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
  const fmt = (cells: string[]) => cells.map((cell, i) => cell.padEnd(widths[i]!)).join("  ");
  process.stdout.write(`${chalk.bold(fmt(cols))}\n`);
  for (const r of rows) process.stdout.write(`${fmt(cols.map((c) => r[c] ?? ""))}\n`);
}
