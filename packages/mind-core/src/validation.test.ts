import { describe, expect, it } from "vitest";
import { DEFAULT_GENERATION_SETTINGS } from "./profiles";
import { validateGenerationSettings } from "./validation";

describe("generation validation", () => {
  it("accepts defaults and rejects invalid temperature", () => {
    expect(validateGenerationSettings(DEFAULT_GENERATION_SETTINGS)).toBe(DEFAULT_GENERATION_SETTINGS);
    expect(() =>
      validateGenerationSettings({ ...DEFAULT_GENERATION_SETTINGS, temperature: 3 })
    ).toThrow("Temperature");
  });
});
