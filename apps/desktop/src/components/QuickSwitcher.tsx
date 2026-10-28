import { Dialog } from "@base-ui/react/dialog";
import { Button, Input } from "./Controls";
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
  const selectedWorkspaceId = useMindStore((state) => state.selectedWorkspaceId);
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
        setOpen(false);
        event.preventDefault();
        createConversation(selectedWorkspaceId ?? undefined);
      } else if (event.key === ",") {
        event.preventDefault();
        setSection("settings");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createConversation, selectedWorkspaceId, setSection]);

  const normalized = query.trim().toLocaleLowerCase();
  const matchingDestinations = destinations.filter((item) => item.label.toLocaleLowerCase().includes(normalized));
  const matchingConversations = useMemo(
    () => conversations.filter((item) => item.title.toLocaleLowerCase().includes(normalized)).slice(0, 6),
    [conversations, normalized]
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Portal>
      <Dialog.Backdrop className="switcher-backdrop" />
      <Dialog.Popup className="quick-switcher" initialFocus={input} aria-label="Quick switcher">
        <label><Search size={16} /><Input ref={input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Go to…" /><Button type="button" onClick={() => setOpen(false)} aria-label="Close"><X size={15} /></Button></label>
        <div className="switcher-results">
          <span>Navigate</span>
          {matchingDestinations.map((item) => <Button type="button" key={item.id} onClick={() => { setSection(item.id); setOpen(false); }}>{item.label}</Button>)}
          {matchingConversations.length > 0 && <span>Conversations</span>}
          {matchingConversations.map((item) => <Button type="button" key={item.id} onClick={() => { selectConversation(item.id); setOpen(false); }}>{item.title}</Button>)}
        </div>
      </Dialog.Popup>
    </Dialog.Portal></Dialog.Root>
  );
}
