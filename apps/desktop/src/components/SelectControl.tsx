import { Check, ChevronDown } from "lucide-react";
import { useCallback, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

export type SelectOption = {
  value: string;
  label: string;
  detail?: string;
  disabled?: boolean;
};

type SelectControlProps = {
  value: string;
  options: SelectOption[];
  onChange(value: string): void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  variant?: "field" | "compact";
};

type MenuPosition = { top: number; left: number; width: number };

export function SelectControl({
  value,
  options,
  onChange,
  label,
  placeholder = "Choose an option",
  disabled = false,
  variant = "field"
}: SelectControlProps) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<MenuPosition>({ top: 0, left: 0, width: 220 });
  const selected = options.find((option) => option.value === value);

  const updatePosition = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.max(rect.width, variant === "compact" ? 190 : 240);
    const estimatedHeight = Math.min(288, options.length * 46 + 12);
    const opensAbove = window.innerHeight - rect.bottom < estimatedHeight + 12 && rect.top > estimatedHeight;
    setPosition({
      top: opensAbove ? Math.max(8, rect.top - estimatedHeight - 6) : rect.bottom + 6,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      width
    });
  }, [options.length, variant]);

  const show = () => {
    if (disabled || !options.length) return;
    const selectedIndex = options.findIndex((option) => option.value === value && !option.disabled);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : Math.max(0, options.findIndex((option) => !option.disabled)));
    updatePosition();
    setOpen(true);
  };

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) window.setTimeout(() => trigger.current?.focus(), 0);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    close();
  };

  const move = (direction: 1 | -1) => {
    if (!options.length) return;
    let next = activeIndex;
    for (let attempts = 0; attempts < options.length; attempts += 1) {
      next = (next + direction + options.length) % options.length;
      if (!options[next]?.disabled) {
        setActiveIndex(next);
        return;
      }
    }
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      show();
    }
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(Math.max(0, options.findIndex((option) => !option.disabled)));
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(Math.max(0, options.findLastIndex((option) => !option.disabled)));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      close(false);
    }
  };

  useLayoutEffect(() => {
    if (!open) return;
    menu.current?.focus();
    const reposition = () => updatePosition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, updatePosition]);

  return (
    <>
      <button
        ref={trigger}
        className={`select-control is-${variant}`}
        type="button"
        disabled={disabled || !options.length}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => open ? close(false) : show()}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={selected ? "" : "is-placeholder"}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && createPortal(
        <div className="select-popover-layer" onMouseDown={() => close(false)}>
          <div
            ref={menu}
            id={id}
            className="select-popover"
            role="listbox"
            tabIndex={-1}
            aria-label={label}
            aria-activedescendant={`${id}-option-${activeIndex}`}
            style={position}
            onKeyDown={handleMenuKeyDown}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {options.map((option, index) => (
              <button
                id={`${id}-option-${index}`}
                key={option.value}
                className={index === activeIndex ? "is-active" : ""}
                type="button"
                role="option"
                aria-selected={option.value === value}
                disabled={option.disabled}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(index)}
              >
                <span><strong>{option.label}</strong>{option.detail && <small>{option.detail}</small>}</span>
                {option.value === value && <Check size={14} aria-hidden="true" />}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
