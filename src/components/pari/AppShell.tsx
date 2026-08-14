import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Clock, Home, Plus, ScanLine, User, Users } from "lucide-react";

import { usePari } from "@/data/store";
import { emptyDraft } from "@/data/draft";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { Avatar } from "./Avatar";
import { BottomSheet } from "./BottomSheet";

export function Screen({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className="min-h-svh bg-background">
      <div
        className={cn(
          "mx-auto w-full max-w-[430px] pb-[calc(6.5rem+env(safe-area-inset-bottom))]",
          padded && "px-5 pt-4",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function TopBar({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const { currentProfileName } = usePari();

  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 pb-6 pt-3">
      <div className="min-w-0">
        {subtitle ? (
          <p className="mb-1 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
        <h1 className="truncate text-[26px] font-semibold tracking-[-0.03em]">{title}</h1>
      </div>
      {action ?? (
        <Link to="/profile" aria-label="Profile and settings" className="shrink-0">
          <Avatar name={currentProfileName} size="md" />
        </Link>
      )}
    </header>
  );
}

export function Panel({
  children,
  className,
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <section className="space-y-3">
      {title || action ? (
        <div className="flex items-center justify-between px-1">
          {title ? (
            <h2 className="text-[13px] font-medium tracking-tight text-muted-foreground">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      <div className={cn("rounded-3xl bg-surface p-1.5 shadow-soft", className)}>
        {children}
      </div>
    </section>
  );
}

export function Divider() {
  return <div className="mx-4 h-px bg-hairline" />;
}

const NAV_LEFT = [
  { to: "/", labelKey: "nav.home", icon: Home, exact: true },
  { to: "/groups", labelKey: "nav.groups", icon: Users, exact: false },
] as const;

const NAV_RIGHT = [
  { to: "/activity", labelKey: "nav.activity", icon: Clock, exact: false },
  { to: "/profile", labelKey: "nav.profile", icon: User, exact: false },
] as const;

export function BottomNav() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { setDraft, currentPersonId } = usePari();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const start = (target: "/split/amount" | "/split/scan") => {
    setDraft({ ...emptyDraft(currentPersonId), source: target === "/split/scan" ? "receipt" : "manual" });
    setOpen(false);
    navigate({ to: target });
  };

  return (
    <>
      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        <div className="pointer-events-auto mx-4 grid w-full max-w-[390px] grid-cols-5 items-center rounded-[22px] bg-primary px-2 py-1.5 text-primary-foreground shadow-[0_8px_24px_-16px_oklch(0.268_0.046_173.8_/_0.5)]">
          {NAV_LEFT.map((item) => (
            <NavItem key={item.to} {...item} pathname={pathname} />
          ))}

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Split an expense"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground transition-transform duration-200 active:scale-95"
            >
              <Plus className="h-6 w-6" strokeWidth={2} />
            </button>
          </div>

          {NAV_RIGHT.map((item) => (
            <NavItem key={item.to} {...item} pathname={pathname} />
          ))}
        </div>
      </nav>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Split an expense"
        description="Two taps and you're done."
      >
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => start("/split/scan")}
            className="flex w-full items-center gap-4 rounded-2xl bg-surface-strong px-5 py-5 text-left transition-transform active:scale-[0.99]"
          >
            <ScanLine className="h-5 w-5 shrink-0" strokeWidth={1.6} />
            <span>
              <span className="block text-[15px] font-medium tracking-tight">
                Scan receipt
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Take a photo or upload one
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => start("/split/amount")}
            className="flex w-full items-center gap-4 rounded-2xl bg-surface-strong px-5 py-5 text-left transition-transform active:scale-[0.99]"
          >
            <Plus className="h-5 w-5 shrink-0" strokeWidth={1.6} />
            <span>
              <span className="block text-[15px] font-medium tracking-tight">Add amount</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Enter an expense manually
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => start("/split/scan")}
            className="mx-auto block pt-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Multiple receipts
          </button>
        </div>
      </BottomSheet>
    </>
  );
}

function NavItem({
  to,
  labelKey,
  icon: Icon,
  exact,
  pathname,
}: {
  to: string;
  labelKey: string;
  icon: typeof Home;
  exact: boolean;
  pathname: string;
}) {
  const t = useT();
  const active = exact ? pathname === to : pathname.startsWith(to);

  return (
    <Link
      to={to}
      className={cn(
        "flex min-h-[44px] flex-col items-center justify-center gap-1 text-[10px] transition-opacity",
        active ? "opacity-100" : "opacity-55",
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.6} />
      {t(labelKey)}
    </Link>
  );
}
