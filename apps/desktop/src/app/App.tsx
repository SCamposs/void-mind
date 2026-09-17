import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../components/AppShell";
import { BootIntro } from "../components/BootIntro";
import { ConversationScreen } from "../features/conversations/ConversationScreen";
import { HomeScreen } from "../features/home/HomeScreen";
import { KnowledgeScreen } from "../features/knowledge/KnowledgeScreen";
import { ModelsScreen } from "../features/models/ModelsScreen";
import { OnboardingScreen } from "../features/onboarding/OnboardingScreen";
import { SettingsScreen } from "../features/settings/SettingsScreen";
import { WorkspacesScreen } from "../features/workspaces/WorkspacesScreen";
import { codexBridge } from "../lib/codex-bridge";
import { normalizeCodexModels } from "@void-mind/providers";
import { useMindStore } from "../stores/mind-store";

export function App() {
  const section = useMindStore((state) => state.section);
  const showBootIntro = useMindStore((state) => state.preferences.showBootIntro);
  const onboardingComplete = useMindStore((state) => state.preferences.onboardingComplete);
  const [bootVisible, setBootVisible] = useState(showBootIntro);

  const finishBoot = useCallback(() => {
    setBootVisible(false);
  }, []);

  useEffect(() => {
    if (!bootVisible) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(finishBoot, reduced ? 250 : 4_500);
    return () => window.clearTimeout(timer);
  }, [bootVisible, finishBoot]);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    const refresh = async () => {
      try {
        const status = await codexBridge.start();
        if (!active) return;
        useMindStore.getState().setCodexStatus(status);
        const account = await codexBridge.account();
        if (!active) return;
        useMindStore.getState().setCodexAccount(account);
        if (account.state === "connected") {
          const models = normalizeCodexModels(await codexBridge.models());
          if (!active) return;
          useMindStore.getState().setProviderModels("openai-codex", models);
          const current = useMindStore.getState();
          if (!current.defaultPreference.modelId) {
            const preferred = models.find((model) => model.isDefault) ?? models[0];
            if (preferred) current.setDefaultPreference({
              providerId: "openai-codex",
              modelId: preferred.id,
              reasoningEffort: preferred.defaultReasoningEffort,
              serviceTier: preferred.defaultServiceTier
            });
          }
        } else {
          useMindStore.getState().setProviderModels("openai-codex", []);
        }
      } catch (error) {
        if (active) {
          const current = useMindStore.getState();
          const previous = current.codexStatus;
          current.setProviderModels("openai-codex", []);
          current.setCodexStatus({
            ...(previous ?? { installed: false, running: false }),
            state: "error",
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    };
    void refresh();
    void codexBridge.subscribe((event) => {
      if (!active) return;
      if (event.type === "loginCompleted") {
        useMindStore.getState().setCodexLogin(event.success
          ? { state: "success", message: "ChatGPT account connected." }
          : { state: "error", message: event.error || "ChatGPT sign-in could not be completed." }
        );
        void refresh();
      } else if (event.type === "accountUpdated") {
        void refresh();
      }
    }).then((stop) => {
      if (active) unsubscribe = stop;
      else stop();
    }).catch(() => undefined);
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  return (
    <>
      <div className="app-root-surface" inert={bootVisible || !onboardingComplete}>
        <AppShell>
          {section === "home" && <HomeScreen />}
          {section === "conversations" && <ConversationScreen />}
          {section === "workspaces" && <WorkspacesScreen />}
          {section === "knowledge" && <KnowledgeScreen />}
          {section === "models" && <ModelsScreen />}
          {section === "settings" && <SettingsScreen />}
        </AppShell>
      </div>
      {bootVisible && <BootIntro onSkip={finishBoot} />}
      {!bootVisible && !onboardingComplete && <OnboardingScreen />}
    </>
  );
}
