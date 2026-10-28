import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";

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

export function SelectControl({
  value,
  options,
  onChange,
  label,
  placeholder = "Choose an option",
  disabled = false,
  variant = "field"
}: SelectControlProps) {
  const selected = options.find((option) => option.value === value);
  const items = options.map((option) => ({ label: option.label, value: option.value }));

  return (
    <Select.Root
      value={selected?.value ?? null}
      items={items}
      disabled={disabled || !options.length}
      onValueChange={(nextValue) => {
        if (nextValue !== null) onChange(nextValue);
      }}
    >
      <Select.Trigger className={`select-control is-${variant}`} aria-label={label}>
        <Select.Value placeholder={placeholder}>{selected?.label ?? placeholder}</Select.Value>
        <Select.Icon className="select-icon">
          <ChevronDown size={14} aria-hidden="true" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          className={`select-positioner is-${variant}`}
          sideOffset={6}
          align="start"
          alignItemWithTrigger={false}
          collisionAvoidance={{ side: "flip", align: "shift" }}
        >
          <Select.Popup className="select-popover">
            <Select.List className="select-list">
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  className="select-option"
                  value={option.value}
                  disabled={option.disabled}
                >
                  <Select.ItemText className="select-option-copy">
                    <strong>{option.label}</strong>
                    {option.detail && <small>{option.detail}</small>}
                  </Select.ItemText>
                  <Select.ItemIndicator className="select-option-indicator">
                    <Check size={14} aria-hidden="true" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
