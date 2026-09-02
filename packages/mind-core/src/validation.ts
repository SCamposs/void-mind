import type { GenerationSettings, ModelDescriptor } from "./types";

export function validateGenerationSettings(settings: GenerationSettings): GenerationSettings {
  if (settings.temperature < 0 || settings.temperature > 2) {
    throw new Error("Temperature must be between 0 and 2.");
  }
  if (settings.topP <= 0 || settings.topP > 1) throw new Error("Top-p must be above 0 and at most 1.");
  if (!Number.isInteger(settings.topK) || settings.topK < 0) throw new Error("Top-k must be 0 or greater.");
  if (settings.repeatPenalty < 0.5 || settings.repeatPenalty > 2) {
    throw new Error("Repeat penalty must be between 0.5 and 2.");
  }
  if (!Number.isInteger(settings.maxTokens) || settings.maxTokens < 1) {
    throw new Error("Maximum tokens must be a positive integer.");
  }
  if (!Number.isInteger(settings.context) || settings.context < 256) {
    throw new Error("Context must be at least 256 tokens.");
  }
  return settings;
}

export function validateModelDescriptor(model: ModelDescriptor): ModelDescriptor {
  if (!model.id.trim() || !model.displayName.trim() || !model.identifier.trim()) {
    throw new Error("Model id, display name, and identifier are required.");
  }
  if (model.location === "local" && model.providerId !== "void-local") {
    throw new Error("Local models must use a local provider.");
  }
  return model;
}
