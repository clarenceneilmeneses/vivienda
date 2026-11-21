import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

/**
 * "A new version is ready — Refresh", after a deploy (as in Malaya). Checks
 * /version.json when the tab comes back into view and every 10 minutes; in
 * development there is no version file, so it never shows.
 */
export function UpdateBanner() {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    let stopped = false;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const { build } = (await res.json()) as { build?: string };
        if (!stopped && build && build !== __BUILD_ID__) setReady(true);
      } catch {
        /* offline: try again later */
      }
    };
    const id = window.setInterval(check, 10 * 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  if (!ready || dismissed) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-3 z-[60] mx-auto flex w-[calc(100%-2rem)] max-w-md items-center gap-3 rounded-full border border-sand-200 bg-white/95 py-2 pr-2 pl-4 text-sm shadow-level-4 backdrop-blur"
    >
      <span className="flex-1 text-ink">A new version is ready.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-brand-700 px-3 text-xs font-semibold text-sand-50"
      >
        <RefreshCw className="size-3.5" /> Refresh
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="grid size-8 cursor-pointer place-items-center rounded-full text-ink-muted hover:bg-sand-100"
        aria-label="Later"
        title="Later"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
