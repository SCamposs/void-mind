import { Dialog } from "@base-ui/react/dialog";
import { Button } from "./Controls";
import {
  BookOpen,
  Brain,
  House,
  Menu,
  MessageSquareText,
  Settings,
  Shapes,
  X
} from "lucide-react";
import type { PropsWithChildren } from "react";
import { useRef } from "react";
import { useMediaQuery } from "../lib/use-media-query";
import { useMindStore, selectedConversation, type AppSection } from "../stores/mind-store";
import { VoidMark } from "./VoidMark";
import { QuickSwitcher } from "./QuickSwitcher";
import { WindowControls } from "./WindowControls";

const items: Array<{
  id: AppSection;
  label: string;
  icon: typeof MessageSquareText;
}> = [
  { id: "home", label: "Home", icon: House },
  { id: "conversations", label: "Conversations", icon: MessageSquareText },
  { id: "workspaces", label: "Workspaces", icon: Shapes },
  { id: "knowledge", label: "Knowledge", icon: BookOpen },
  { id: "models", label: "Intelligence", icon: Brain },
  { id: "settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: PropsWithChildren) {
  const section = useMindStore((state) => state.section);
  const open = useMindStore((state) => state.navigationOpen);
  const setSection = useMindStore((state) => state.setSection);
  const setOpen = useMindStore((state) => state.setNavigationOpen);
  const account = useMindStore((state) => state.codexAccount);
  const connections = useMindStore((state) => state.connections);
  const selectedProviderId = useMindStore((state) => {
    const conversation = state.section === "conversations"
      ? selectedConversation(state) : undefined;
    const workspace = state.workspaces.find((item) => item.id === conversation?.workspaceId);
    return conversation?.providerOverride?.providerId ?? workspace?.preference?.providerId ?? state.defaultPreference.providerId;
  });
  const compact = useMediaQuery("(max-width: 780px)");
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLElement>(null);


  const navigationContent = (
    <nav
          ref={navigation}
          id="primary-navigation"
          className={`primary-nav ${open ? "is-open" : ""}`}
          aria-label="Primary"
          aria-hidden={compact && !open}
          inert={compact && !open}
        >
          <div className="nav-items">
            {items.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                type="button"
                className={section === id ? "is-active" : ""}
                onClick={() => setSection(id)}
                aria-current={section === id ? "page" : undefined}
              >
                <Icon size={17} strokeWidth={1.7} />
                <span>{label}</span>
              </Button>
            ))}
          </div>
        </nav>
  );

  return (
    <Dialog.Root open={compact && open} onOpenChange={setOpen}><div className="app-shell">
      <header className="app-header">
        <div className="titlebar-drag-region" data-tauri-drag-region aria-hidden="true" />
        <Button
          ref={menuButton}
          className="icon-button mobile-menu"
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="primary-navigation"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </Button>
        <Button
          className="brand-button"
          type="button"
          onClick={() => setSection("home")}
          aria-label="Open Home"
        >
          <VoidMark />
          <span>VOID <strong>MIND</strong></span>
        </Button>
        <div className="app-header-actions">
          <span className="privacy-note">
            {selectedProviderId === "openai-codex"
              ? account?.state === "connected" ? "Codex connected" : "Codex not connected"
              : selectedProviderId === "openai-chatgpt" ? connections?.accounts.some((a) => a.id === connections.activeAccountId && a.connected && a.planAuthorized) ? "ChatGPT connected" : "ChatGPT not connected" : selectedProviderId === "openai-api" ? connections?.apiConnected ? "OpenAI API connected" : "API not connected" : "Local runtime"}
          </span>
          <WindowControls />
        </div>
      </header>

      <div className="app-body">
        {compact ? <Dialog.Portal><Dialog.Backdrop className="nav-scrim" /><Dialog.Popup render={navigationContent} finalFocus={menuButton} /></Dialog.Portal> : navigationContent}
        <main className="primary-surface">{children}</main>
      </div>
      <QuickSwitcher />
    </div></Dialog.Root>
  );
}
