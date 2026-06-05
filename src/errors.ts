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
