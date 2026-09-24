import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Lock, Mail, MapPin, Phone } from "lucide-react";
import { useSettings } from "../../lib/queries";
import { SITE } from "../../lib/site";
import { cn } from "../../lib/utils";

/** The logo mark beside the name, set like Malaya's wordmark: tracked display type, a thin line beneath. */
export function Wordmark({ size = "header" }: { size?: "header" | "footer" }) {
  const big = size === "header";
  return (
    <span className="inline-flex items-center gap-3">
      <img
        src="/images/logo-192.png"
        alt=""
        className={cn("shrink-0 rounded-full shadow-level-2", big ? "size-11" : "size-14")}
      />
      <span className="inline-block leading-none">
        <span
          className={cn(
            "block font-display font-normal text-brand-700",
            big ? "text-[1.55rem] tracking-[0.2em]" : "text-[1.5rem] tracking-[0.22em]",
          )}
        >
          VIVIENDA
        </span>
        <span className="mt-1 block pl-[0.3em] text-center text-[9px] font-medium tracking-[0.3em] text-brand-700 uppercase">
          Our Tropical Haven
        </span>
      </span>
    </span>
  );
}

/** Slides the header away on the way down and back on the way up. */
function useHideOnScroll() {
  const [hidden, setHidden] = useState(false);
  const last = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - last.current;
      if (Math.abs(delta) < 8) return;
      setHidden(delta > 0 && y > 120);
      last.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return hidden;
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn("transition-colors hover:text-brand-700", isActive && "font-semibold");

export default function PublicLayout() {
  const { data: s } = useSettings();
  const hidden = useHideOnScroll();
  const { pathname, hash } = useLocation();

  // New page starts at the top, unless it's a jump to a section (Home handles those).
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const phone = s?.phone || SITE.phone;
  const email = s?.email || SITE.email;
  const address = s?.address || SITE.address;
  const facebook = s?.facebook_url || SITE.facebook;
  const mapUrl = s?.map_url || SITE.mapUrl;
  const telHref = phone === SITE.phone ? SITE.phoneHref : `tel:${phone.replace(/[^\d+]/g, "")}`;

  // Checkout drops the nav for the wordmark and a reassurance, as in Malaya.
  if (pathname === "/book") {
    return (
      <div data-site="public" className="flex min-h-screen flex-col bg-white">
        <header className="border-b border-sand-200/60 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-8">
            <Link to="/" aria-label="Vivienda home">
              <Wordmark />
            </Link>
            <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
              <Lock className="size-4" /> Secure booking
            </span>
          </div>
        </header>
        <main className="flex-1">
          <Outlet />
        </main>
        <footer className="border-t border-sand-200/60 bg-sand-50 py-5 text-center text-sm text-ink-muted">
          Questions? Call{" "}
          <a href={telHref} className="font-medium text-brand-700 hover:underline">
            {phone}
          </a>
        </footer>
      </div>
    );
  }

  return (
    <div data-site="public" className="flex min-h-screen flex-col bg-white">
      <header
        className={cn(
          "sticky top-0 z-30 bg-white/85 backdrop-blur transition-transform duration-300",
          hidden ? "-translate-y-full" : "translate-y-0",
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3 sm:px-8">
          <Link to="/" aria-label="Vivienda home">
            <Wordmark />
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-ink md:flex">
            <Link to="/#stay" className="transition-colors hover:text-brand-700">
              Stay
            </Link>
            <Link to="/#contact" className="transition-colors hover:text-brand-700">
              Contact
            </Link>
            <NavLink to="/my-booking" className={navClass}>
              My Booking
            </NavLink>
          </nav>
          <div className="flex items-center gap-3">
            <NavLink to="/my-booking" className={cn(navClass({ isActive: false }), "hidden text-sm whitespace-nowrap sm:inline md:hidden")}>
              My Booking
            </NavLink>
            <Link
              to="/#stay"
              className="inline-flex h-10 items-center rounded-full bg-brand-700 px-5 text-sm whitespace-nowrap font-medium text-sand-50 shadow-level-2 transition-colors hover:bg-brand-700/90 sm:px-6"
            >
              Book Now
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer id="contact" className="scroll-mt-4 border-t border-sand-200/70 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-14 pb-14 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1.5fr_1fr_1fr_1.3fr]">
          <div>
            <Wordmark size="footer" />
            <p className="mt-5 max-w-xs text-sm text-ink">A private pool resort in Alitagtag, Batangas.</p>
            <p className="mt-5 text-[11px] text-brand-700">
              &copy; {new Date().getFullYear()} {s?.resort_name ?? SITE.name}. All rights reserved.
            </p>
          </div>

          <FooterColumn title="EXPLORE">
            <FooterLink to="/#stay">Stay</FooterLink>
            <FooterLink to="/#stay">Book a stay</FooterLink>
          </FooterColumn>

          <FooterColumn title="SUPPORT">
            <FooterLink to="/my-booking">My Booking</FooterLink>
            <FooterLink href={facebook} external>
              Facebook page
            </FooterLink>
          </FooterColumn>

          <FooterColumn title="CONTACT">
            <li>
              <a href={telHref} className="inline-flex items-center gap-2.5 text-ink-muted transition-colors hover:text-brand-700">
                <Phone className="size-4 text-brand-700" /> {phone}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${email}`}
                className="inline-flex items-center gap-2.5 break-all text-ink-muted transition-colors hover:text-brand-700"
              >
                <Mail className="size-4 shrink-0 text-brand-700" /> {email}
              </a>
            </li>
            <li>
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-start gap-2.5 text-ink-muted transition-colors hover:text-brand-700"
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand-700" /> {address}
              </a>
            </li>
            <li>
              <a
                href={facebook}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Vivienda on Facebook"
                className="inline-flex items-center gap-2.5 text-ink-muted transition-colors hover:text-brand-700"
              >
                <FacebookMark /> Facebook
              </a>
            </li>
          </FooterColumn>
        </div>
      </footer>
    </div>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-[0.2em] text-brand-700">{title}</p>
      <ul className="mt-4 space-y-3.5 text-[13px]">{children}</ul>
    </div>
  );
}

function FooterLink({
  to,
  href,
  external,
  children,
}: {
  to?: string;
  href?: string;
  external?: boolean;
  children: ReactNode;
}) {
  const cls = "text-ink-muted transition-colors hover:text-brand-700";
  return (
    <li>
      {to ? (
        <Link to={to} className={cls}>
          {children}
        </Link>
      ) : (
        <a href={href} className={cls} {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}>
          {children}
        </a>
      )}
    </li>
  );
}

function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 text-brand-700" fill="currentColor" aria-hidden>
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z" />
    </svg>
  );
}
