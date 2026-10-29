import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ModelDescriptor } from "@void-mind/mind-core";
import { DEFAULT_MIND_STATE } from "@void-mind/persistence";
import { afterEach, expect, it, vi } from "vitest";
import { useMindStore } from "../../stores/mind-store";
import { ModelsScreen } from "./ModelsScreen";

// This regression concerns model preferences, independently of account requests.
vi.mock("../../components/ConnectionsPanel", () => ({ ConnectionsPanel: () => null }));
afterEach(cleanup);

it("binds the global Active badge and capability controls to the global model instead of a stale catalog selection", () => {
  const legacy: ModelDescriptor = {
    id: "openai-codex:legacy", displayName: "Legacy", identifier: "legacy", version: "test",
    providerId: "openai-codex", location: "remote", languages: [], capabilities: ["reasoning"],
    isDefault: true, defaultReasoningEffort: "low",
    reasoningEfforts: [{ id: "low", description: "Low" }, { id: "high", description: "High" }]
  };
  const direct: ModelDescriptor = {
    id: "openai-chatgpt:direct", displayName: "Direct", identifier: "direct", version: "test",
    providerId: "openai-chatgpt", location: "remote", languages: [], capabilities: [], isDefault: true
  };
  useMindStore.setState({
    ...structuredClone(DEFAULT_MIND_STATE), models: [legacy, direct], selectedModelId: legacy.id,
    defaultPreference: { providerId: direct.providerId, modelId: direct.id }
  });
  render(<ModelsScreen />);
  expect(screen.getByRole("button", { name: /Direct.*Active/ })).toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: "Reasoning effort" })).not.toBeInTheDocument();

  act(() => useMindStore.getState().setDefaultPreference({
    providerId: legacy.providerId, modelId: legacy.id, reasoningEffort: "low"
  }));
  expect(screen.getByRole("button", { name: /Legacy.*Active/ })).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Reasoning effort" })).toHaveTextContent("low");

  fireEvent.click(screen.getByRole("button", { name: /Direct.*Use model/ }));
  expect(screen.getByRole("button", { name: /Direct.*Active/ })).toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: "Reasoning effort" })).not.toBeInTheDocument();
  expect(useMindStore.getState().defaultPreference).toMatchObject({ providerId: direct.providerId, modelId: direct.id });
});
