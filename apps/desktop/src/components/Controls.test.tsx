import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button, CheckControl, SwitchControl, Textarea } from "./Controls";
vi.stubGlobal("PointerEvent", MouseEvent);

describe("VOID shared controls", () => {
  it("keeps multiline editing and its original keyboard handlers", () => {
    const change = vi.fn(); const keydown = vi.fn();
    render(<Textarea aria-label="Message" defaultValue={"First\nSecond"} rows={3} onChange={change} onKeyDown={keydown} />);
    const input = screen.getByRole("textbox", { name: "Message" });
    expect(input.tagName).toBe("TEXTAREA"); expect(input).toHaveValue("First\nSecond");
    fireEvent.change(input, { target: { value: "Updated\nText" } }); fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(change).toHaveBeenCalledOnce(); expect(keydown).toHaveBeenCalledOnce();
  });
  it("blocks disabled actions and preserves checkbox/switch semantics", () => {
    const action = vi.fn(); const check = vi.fn(); const toggle = vi.fn();
    render(<><Button disabled onClick={action}>Unavailable</Button><CheckControl checked={false} onCheckedChange={check} aria-label="Source" /><SwitchControl checked onCheckedChange={toggle} aria-label="Intro" /></>);
    fireEvent.click(screen.getByRole("button", { name: "Unavailable" })); expect(action).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Source" })); expect(check).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("switch", { name: "Intro" })); expect(toggle).toHaveBeenCalledWith(false);
  });
});
