import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../../lib/auth";
import type { Inquiry } from "../../lib/guest";
import { AuthDialog, type AuthMode } from "./AuthDialog";

/**
 * Two things any page on the guest site can ask for: "sign me in" and "open
 * the chat". Signing in can carry what to do next, so pressing Message host
 * while signed out ends with the chat open, not back where you started.
 */
interface GuestUi {
  signIn: (opts?: { mode?: AuthMode; then?: () => void }) => void;
  chatOpen: boolean;
  inquiry: Inquiry | null;
  openChat: (inquiry?: Inquiry | null) => void;
  closeChat: () => void;
}

const Ctx = createContext<GuestUi | null>(null);

export function GuestUiProvider({ children }: { children: ReactNode }) {
  const { session, isAdmin, loading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [chatOpen, setChatOpen] = useState(false);
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const after = useRef<(() => void) | null>(null);

  const openChat = useCallback((next?: Inquiry | null) => {
    setInquiry(next ?? null);
    setChatOpen(true);
  }, []);

  const signIn = useCallback((opts?: { mode?: AuthMode; then?: () => void }) => {
    after.current = opts?.then ?? null;
    setMode(opts?.mode ?? "signin");
    setAuthOpen(true);
  }, []);

  // Once the session lands, close the dialog and carry on with what was asked.
  useEffect(() => {
    if (loading || !session || !authOpen) return;
    setAuthOpen(false);
    const next = after.current;
    after.current = null;
    if (next && !isAdmin) setTimeout(next, 0);
  }, [session, isAdmin, loading, authOpen]);

  return (
    <Ctx.Provider value={{ signIn, chatOpen, inquiry, openChat, closeChat: () => setChatOpen(false) }}>
      {children}
      <AuthDialog
        open={authOpen}
        mode={mode}
        onMode={setMode}
        onClose={() => {
          after.current = null;
          setAuthOpen(false);
        }}
      />
    </Ctx.Provider>
  );
}

export function useGuestUi() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGuestUi must be used inside GuestUiProvider");
  return ctx;
}
