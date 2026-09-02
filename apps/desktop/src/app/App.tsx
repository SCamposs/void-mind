import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../components/AppShell";
import { BootIntro } from "../components/BootIntro";
import { ConversationScreen } from "../features/conversations/ConversationScreen";
import { FoundationScreen } from "../features/foundations/FoundationScreen";
import { ModelsScreen } from "../features/models/ModelsScreen";
import { SettingsScreen } from "../features/settings/SettingsScreen";
import { useMindStore } from "../stores/mind-store";

export function App() {
  const section = useMindStore((state) => state.section);
  const showBootIntro = useMindStore((state) => state.preferences.showBootIntro);
  const updatePreferences = useMindStore((state) => state.updatePreferences);
  const [bootVisible, setBootVisible] = useState(showBootIntro);

  const finishBoot = useCallback(() => {
    setBootVisible(false);
    updatePreferences({ onboardingComplete: true });
  }, [updatePreferences]);

  useEffect(() => {
    if (!bootVisible) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(finishBoot, reduced ? 250 : 4_500);
    return () => window.clearTimeout(timer);
  }, [bootVisible, finishBoot]);

  return (
    <>
      <div className="app-root-surface" inert={bootVisible}>
        <AppShell>
          {section === "conversations" && <ConversationScreen />}
          {section === "workspaces" && (
            <FoundationScreen
              title="Workspaces"
              description="Workspaces will group conversations, documents, instructions, memory controls, and preferred models. This foundation does not create or imply workspace data yet."
            />
          )}
          {section === "knowledge" && (
            <FoundationScreen
              title="Knowledge"
              description="Knowledge will contain sources you explicitly provide. Indexing, retrieval, and workspace-specific context are intentionally not implemented in this foundation."
            />
          )}
          {section === "models" && <ModelsScreen />}
          {section === "settings" && <SettingsScreen />}
        </AppShell>
      </div>
      {bootVisible && <BootIntro onSkip={finishBoot} />}
    </>
  );
}
