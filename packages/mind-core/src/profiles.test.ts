import { describe, expect, it } from "vitest";
import { DEFAULT_CUSTOM_PROFILE, DEFAULT_PROFILES, resolveProfile } from "./profiles";

describe("profile defaults", () => {
  it("provides the four human-intent defaults and a custom profile", () => {
    expect(DEFAULT_PROFILES.map((profile) => profile.id)).toEqual([
      "general",
      "creative",
      "analytical",
      "concise"
    ]);
    expect(resolveProfile(DEFAULT_PROFILES, DEFAULT_CUSTOM_PROFILE, "custom").id).toBe("custom");
  });
});
