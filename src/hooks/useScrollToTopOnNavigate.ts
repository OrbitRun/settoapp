import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Global forward-navigation scroll reset.
 *
 * Setto scrolls the document (Screen has no inner overflow container), so a new
 * screen can otherwise inherit the previous screen's offset. Back/forward
 * (POP) is left to TanStack's scroll restoration; only pathname changes from a
 * push/replace reset to the top. Search/hash changes and bottom sheets never
 * trigger it, because they don't change the pathname.
 */
export function useScrollToTopOnNavigate() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const action = useRouterState({ select: (state) => state.location.state?.__TSR_index });
  const previous = useRef<string | null>(null);
  const previousIndex = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const first = previous.current === null;
    const samePath = previous.current === pathname;
    // History index goes down on Back — preserve the restored position there.
    const isBack =
      typeof action === "number" &&
      typeof previousIndex.current === "number" &&
      action < previousIndex.current;

    previous.current = pathname;
    previousIndex.current = action;

    if (first || samePath || isBack) return;

    const toTop = () => {
      window.scrollTo(0, 0);
      const el = document.scrollingElement ?? document.documentElement;
      if (el) el.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    };

    toTop();
    // Run again after layout/paint so late-mounting content can't restore an offset.
    const raf = requestAnimationFrame(toTop);
    return () => cancelAnimationFrame(raf);
  }, [pathname, action]);
}
