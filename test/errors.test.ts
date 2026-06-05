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
