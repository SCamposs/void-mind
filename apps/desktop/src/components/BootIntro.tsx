import { Button } from "./Controls";
import { Dialog } from "@base-ui/react/dialog";
type BootIntroProps = {
  onSkip(): void;
};

export function BootIntro({ onSkip }: BootIntroProps) {
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onSkip(); }}><Dialog.Portal><Dialog.Popup
      className="boot-intro"
      aria-label="VOID Mind introduction"
    >
      <div className="boot-light" aria-hidden="true" />
      <div className="boot-mark" aria-hidden="true">
        <svg viewBox="0 0 100 100" role="presentation">
          <path
            className="boot-logo-path"
            d="M 10 5 L 50 95 L 90 5 L 42 45 L 70 25 L 50 70 L 21.1 5 Z"
          />
        </svg>
        <span className="boot-word">MIND</span>
      </div>
      <Button className="boot-skip" type="button" onClick={onSkip} autoFocus>
        Skip intro
      </Button>
    </Dialog.Popup></Dialog.Portal></Dialog.Root>
  );
}
