import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_MIND_STATE } from "@void-mind/persistence";
import { afterEach, expect, it } from "vitest";
import { useMindStore } from "../../stores/mind-store";
import { HomeScreen } from "./HomeScreen";

afterEach(cleanup);

it("rejects form submission without an available model, even when the prompt is nonempty", () => {
  useMindStore.setState({ ...structuredClone(DEFAULT_MIND_STATE), draftConversation: null, queuedGenerationId: null });
  render(<HomeScreen />);
  const prompt = screen.getByRole("textbox", { name: "Start a conversation" });
  fireEvent.change(prompt, { target: { value: "A question before connecting a provider" } });
  expect(screen.getByRole("button", { name: "Start conversation" })).toBeDisabled();
  // Enter uses requestSubmit(), which can submit despite a disabled submit button.
  fireEvent.submit(prompt.closest("form")!);
  expect(useMindStore.getState().conversations).toEqual([]);
  expect(useMindStore.getState().draftConversation).toBeNull();
  expect(useMindStore.getState().queuedGenerationId).toBeNull();
  expect(prompt).toHaveValue("A question before connecting a provider");
});
