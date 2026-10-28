import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Button, CheckControl, SwitchControl, Textarea, NumberControl } from "./Controls";
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
  it("keeps controlled drafts editable and clears them after send", () => {
    function Draft() { const [value, setValue] = useState(""); return <><Textarea aria-label="Draft" value={value} onChange={(event) => setValue(event.target.value)} /><Button onClick={() => setValue("")}>Send draft</Button></>; }
    render(<Draft />); const input = screen.getByRole("textbox", { name: "Draft" });
    fireEvent.change(input, { target: { value: "First\nSecond" } }); expect(input).toHaveValue("First\nSecond");
    fireEvent.click(screen.getByRole("button", { name: "Send draft" })); expect(input).toHaveValue("");
  });
  it("associates numeric labels with the editable input and handles keyboard stepping", () => {
    const update = vi.fn(); render(<label>Context size<NumberControl value={512} min={256} step={256} onValueChange={update} /></label>);
    const input = screen.getByLabelText("Context size"); expect(input.tagName).toBe("INPUT");
    fireEvent.keyDown(input, { key: "ArrowUp" }); expect(update).toHaveBeenCalledWith(768);
  });
});
