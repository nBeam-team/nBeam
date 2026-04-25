import { Logo } from './Logo';

interface Props {
  showHome?: boolean;
  onHome?: () => void;
}

export function Header({ showHome, onHome }: Props) {
  return (
    <header className="relative z-30">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 h-20 flex items-center justify-between">
        <button
          onClick={onHome}
          className="cursor-pointer disabled:cursor-default"
          disabled={!showHome}
          aria-label="Home"
        >
          <Logo />
        </button>
        <div className="flex items-center gap-6 text-[13px]">
          <span className="hidden sm:inline-flex items-center gap-2 text-ink-500">
            <span className="w-1.5 h-1.5 rounded-full bg-sage" />
            <span className="font-medium">solar, designed</span>
          </span>
          {showHome ? (
            <button
              onClick={onHome}
              className="nb-link text-ink-700"
            >
              ← back
            </button>
          ) : null}
        </div>
      </div>
      <div className="max-w-[1200px] mx-auto px-6 md:px-10">
        <div className="h-px bg-hairline" />
      </div>
    </header>
  );
}
