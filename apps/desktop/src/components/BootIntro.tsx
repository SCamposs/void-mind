import { Button } from "./Controls";
type BootIntroProps = {
  onSkip(): void;
};

export function BootIntro({ onSkip }: BootIntroProps) {
  return (
    <section
      className="boot-intro"
      role="dialog"
      aria-modal="true"
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
    </section>
  );
}
