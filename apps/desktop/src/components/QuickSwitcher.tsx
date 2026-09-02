import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMindStore, type AppSection } from "../stores/mind-store";

const destinations: Array<{ id: AppSection; label: string }> = [
  { id: "home", label: "Home" },
  { id: "conversations", label: "Conversations" },
  { id: "workspaces", label: "Workspaces" },
  { id: "knowledge", label: "Knowledge" },
  { id: "models", label: "Intelligence" },
  { id: "settings", label: "Settings" }
];

export function QuickSwitcher() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const conversations = useMindStore((state) => state.conversations);
  const createConversation = useMindStore((state) => state.createConversation);
  const selectConversation = useMindStore((state) => state.selectConversation);
  const setSection = useMindStore((state) => state.setSection);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        if (event.key === "Escape") setOpen(false);
        return;
      }
      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        createConversation();
      } else if (event.key === ",") {
        event.preventDefault();
        setSection("settings");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createConversation, setSection]);

  useEffect(() => {
    if (open) window.setTimeout(() => input.current?.focus(), 0);
    else setQuery("");
  }, [open]);

  const normalized = query.trim().toLocaleLowerCase();
  const matchingDestinations = destinations.filter((item) => item.label.toLocaleLowerCase().includes(normalized));
  const matchingConversations = useMemo(
    () => conversations.filter((item) => item.title.toLocaleLowerCase().includes(normalized)).slice(0, 6),
    [conversations, normalized]
  );

  if (!open) return null;
  return (
    <div className="switcher-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
      <section className="quick-switcher" role="dialog" aria-modal="true" aria-label="Quick switcher" onMouseDown={(event) => event.stopPropagation()}>
        <label><Search size={16} /><input ref={input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Go to…" /><button type="button" onClick={() => setOpen(false)} aria-label="Close"><X size={15} /></button></label>
        <div className="switcher-results">
          <span>Navigate</span>
          {matchingDestinations.map((item) => <button type="button" key={item.id} onClick={() => { setSection(item.id); setOpen(false); }}>{item.label}</button>)}
          {matchingConversations.length > 0 && <span>Conversations</span>}
          {matchingConversations.map((item) => <button type="button" key={item.id} onClick={() => { selectConversation(item.id); setOpen(false); }}>{item.title}</button>)}
        </div>
      </section>
    </div>
  );
}
