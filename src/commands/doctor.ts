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
        const mark = r.informational
          ? chalk.yellow("•")
          : r.ok
            ? chalk.green("✓")
            : chalk.red("✗");
        process.stdout.write(`${mark} ${r.name}: ${r.detail}\n`);
        if (!r.ok && r.fix) process.stdout.write(`    → ${r.fix}\n`);
      }
      process.stdout.write(
        healthy
          ? chalk.green("\nAll required checks passed.\n")
          : chalk.red("\nSome checks failed.\n"),
      );
    },
    opts,
  );

  return healthy ? EXIT.OK : EXIT.ENV;
}
