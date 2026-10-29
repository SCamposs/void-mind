import { Button as BaseButton } from "@base-ui/react/button";
import { Input as BaseInput } from "@base-ui/react/input";
import { Checkbox } from "@base-ui/react/checkbox";
import { Switch } from "@base-ui/react/switch";
import { Collapsible } from "@base-ui/react/collapsible";
import { ScrollArea } from "@base-ui/react/scroll-area";
import { NumberField } from "@base-ui/react/number-field";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Progress as BaseProgress } from "@base-ui/react/progress";
import { Check, ChevronDown, Minus, Plus } from "lucide-react";
import type { ComponentPropsWithRef, PropsWithChildren, ReactNode, Ref } from "react";

/** Source-owned VOID controls: behavior comes from Base UI, appearance from tokens. */
export function Button(props: ComponentPropsWithRef<"button">) { return <BaseButton {...props} />; }
export function Progress({ value, max = 100, "aria-label": label }: { value: number | null; max?: number; "aria-label": string }) {
  return <BaseProgress.Root value={value === null ? null : max > 0 ? value / max * 100 : 0} aria-label={label} className="void-progress"><BaseProgress.Track><BaseProgress.Indicator /></BaseProgress.Track></BaseProgress.Root>;
}
export function Input(props: ComponentPropsWithRef<"input">) { return <BaseInput {...props} />; }
export function NumberControl({ value, onValueChange, ...props }: { value: number; onValueChange(value: number): void; min?: number; max?: number; step?: number }) {
  return <NumberField.Root className="void-number" value={value} onValueChange={(next) => { if (next !== null) onValueChange(next); }} {...props}><NumberField.Group><NumberField.Input /><NumberField.Decrement aria-label="Decrease"><Minus size={12} /></NumberField.Decrement><NumberField.Increment aria-label="Increase"><Plus size={12} /></NumberField.Increment></NumberField.Group></NumberField.Root>;
}
export function SegmentedControl({ value, onValueChange, options, label }: { value: string; onValueChange(value: string): void; options: Array<{ value: string; label: string }>; label: string }) {
  return <RadioGroup className="segmented-control" value={value} onValueChange={onValueChange} aria-label={label}>
    {options.map((option) => <Radio.Root nativeButton render={<BaseButton type="button" />} className="void-segment" key={option.value} value={option.value}>{option.label}</Radio.Root>)}
  </RadioGroup>;
}
export function Textarea({ ref, ...props }: ComponentPropsWithRef<"textarea">) {
  return <BaseInput ref={ref as Ref<HTMLElement>} render={<textarea {...props} />} />;
}
type CheckedProps = { checked: boolean; onCheckedChange(checked: boolean): void; disabled?: boolean; "aria-label"?: string };
export function CheckControl({ onCheckedChange, ...props }: CheckedProps) { return <Checkbox.Root className="void-check" {...props} onCheckedChange={(checked) => onCheckedChange(checked)}><Checkbox.Indicator className="void-check-indicator"><Check size={12} /></Checkbox.Indicator></Checkbox.Root>; }
export function SwitchControl({ onCheckedChange, ...props }: CheckedProps) { return <Switch.Root className="void-switch" {...props} onCheckedChange={(checked) => onCheckedChange(checked)}><Switch.Thumb className="void-switch-thumb" /></Switch.Root>; }
export function Disclosure({ title, children, className = "", disabled }: PropsWithChildren<{ title: ReactNode; className?: string; disabled?: boolean }>) {
  return <Collapsible.Root className={`void-disclosure ${className}`} disabled={disabled}><Collapsible.Trigger className="void-disclosure-trigger">{title}<ChevronDown size={14} /></Collapsible.Trigger><Collapsible.Panel className="void-disclosure-panel">{children}</Collapsible.Panel></Collapsible.Root>;
}
export function ScrollSurface({ children, className = "", viewportRef, label, onScroll, horizontal = false }: PropsWithChildren<{ className?: string; viewportRef?: Ref<HTMLDivElement>; label?: string; onScroll?: ComponentPropsWithRef<"div">["onScroll"]; horizontal?: boolean }>) {
  return <ScrollArea.Root className="void-scroll-area"><ScrollArea.Viewport ref={viewportRef} className={`void-scroll-viewport ${className}`} aria-label={label} onScroll={onScroll} style={{ overflowX: horizontal ? "auto" : "hidden" }}><ScrollArea.Content style={horizontal ? undefined : { minWidth: 0, width: "100%" }}>{children}</ScrollArea.Content></ScrollArea.Viewport><ScrollArea.Scrollbar className="void-scrollbar" orientation="vertical"><ScrollArea.Thumb className="void-scroll-thumb" /></ScrollArea.Scrollbar>{horizontal && <ScrollArea.Scrollbar className="void-scrollbar" orientation="horizontal"><ScrollArea.Thumb className="void-scroll-thumb" /></ScrollArea.Scrollbar>}<ScrollArea.Corner className="void-scroll-corner" /></ScrollArea.Root>;
}
