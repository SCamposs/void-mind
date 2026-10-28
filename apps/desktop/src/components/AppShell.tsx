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
import { useEffect, useRef } from "react";
import { useMediaQuery } from "../lib/use-media-query";
import { useMindStore, type AppSection } from "../stores/mind-store";
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
  const selectedProviderId = useMindStore((state) => state.selectedProviderId);
  const compact = useMediaQuery("(max-width: 780px)");
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!compact || !open) return;
    navigation.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const handleNavigationKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      } else if (event.key === "Tab") {
        const focusable = [
          menuButton.current,
          ...Array.from(navigation.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])
        ].filter((element): element is HTMLButtonElement => Boolean(element));
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        } else if (!focusable.includes(document.activeElement as HTMLButtonElement)) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleNavigationKeyDown);
    return () => window.removeEventListener("keydown", handleNavigationKeyDown);
  }, [compact, open, setOpen]);

  return (
    <div className="app-shell">
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
              ? account?.state === "connected" ? "ChatGPT connected" : "ChatGPT not connected"
              : selectedProviderId === "openai-chatgpt" ? connections?.accounts.some((a) => a.id === connections.activeAccountId && a.connected && a.planAuthorized) ? "ChatGPT connected" : "ChatGPT not connected" : selectedProviderId === "openai-api" ? connections?.apiConnected ? "OpenAI API connected" : "API not connected" : "Local runtime"}
          </span>
          <WindowControls />
        </div>
      </header>

      <div className="app-body">
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
        {compact && open && (
          <Button
            type="button"
            className="nav-scrim"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
        )}
        <main className="primary-surface">{children}</main>
      </div>
      <QuickSwitcher />
    </div>
  );
}
