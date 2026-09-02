import {
  BookOpen,
  Brain,
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

const items: Array<{
  id: AppSection;
  label: string;
  icon: typeof MessageSquareText;
}> = [
  { id: "conversations", label: "Conversations", icon: MessageSquareText },
  { id: "workspaces", label: "Workspaces", icon: Shapes },
  { id: "knowledge", label: "Knowledge", icon: BookOpen },
  { id: "models", label: "Models", icon: Brain },
  { id: "settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: PropsWithChildren) {
  const section = useMindStore((state) => state.section);
  const open = useMindStore((state) => state.navigationOpen);
  const setSection = useMindStore((state) => state.setSection);
  const setOpen = useMindStore((state) => state.setNavigationOpen);
  const compact = useMediaQuery("(max-width: 780px)");
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!compact || !open) return;
    navigation.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [compact, open, setOpen]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <button
          ref={menuButton}
          className="icon-button mobile-menu"
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
        <button
          className="brand-button"
          type="button"
          onClick={() => setSection("conversations")}
          aria-label="Open conversations"
        >
          <VoidMark />
          <span>VOID <strong>MIND</strong></span>
        </button>
        <span className="privacy-note">Local by default</span>
      </header>

      <div className="app-body">
        <nav
          ref={navigation}
          className={`primary-nav ${open ? "is-open" : ""}`}
          aria-label="Primary"
          aria-hidden={compact && !open}
          inert={compact && !open}
        >
          <div className="nav-items">
            {items.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={section === id ? "is-active" : ""}
                onClick={() => setSection(id)}
                aria-current={section === id ? "page" : undefined}
              >
                <Icon size={17} strokeWidth={1.7} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <p>Private local storage. No telemetry.</p>
        </nav>
        {open && (
          <button
            type="button"
            className="nav-scrim"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
        )}
        <main className="primary-surface">{children}</main>
      </div>
    </div>
  );
}
