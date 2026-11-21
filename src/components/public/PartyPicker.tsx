import type { Unit } from "../../lib/types";
import { money, plural } from "../../lib/format";
import { Stepper } from "./SearchPill";

export interface Party {
  /** Head count: adults plus children. */
  guests: number;
  children: number;
  pets: number;
}

/** Reads the party from the stay and booking URLs (?guests=&kids=&pets=), within the unit's limits. */
export function partyFromParams(params: URLSearchParams, unit?: Pick<Unit, "max_guests" | "max_pets">): Party {
  const guests = Math.max(1, Math.min(Number(params.get("guests")) || 2, unit?.max_guests ?? 99));
  const children = Math.max(0, Math.min(Number(params.get("kids")) || 0, guests - 1));
  const pets = Math.max(0, Math.min(Number(params.get("pets")) || 0, unit?.max_pets ?? 0));
  return { guests, children, pets };
}

export function partyQuery(p: Party) {
  return `guests=${p.guests}${p.children ? `&kids=${p.children}` : ""}${p.pets ? `&pets=${p.pets}` : ""}`;
}

export function partyLabel(p: Party) {
  const adults = p.guests - p.children;
  return [
    plural(adults, "adult"),
    p.children ? plural(p.children, "child", "children") : null,
    p.pets ? plural(p.pets, "pet") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Adults, children and pets, as on Airbnb. Children count toward the guest limit; pets have their own. */
export function PartyPicker({ unit, value, onChange }: { unit: Unit; value: Party; onChange: (p: Party) => void }) {
  const adults = value.guests - value.children;
  const rows: { title: string; note: string; count: number; min: number; max: number; set: (n: number) => void; label: string }[] = [
    {
      title: "Adults",
      note: "Ages 13 or above",
      label: "adults",
      count: adults,
      min: 1,
      max: unit.max_guests - value.children,
      set: (n) => onChange({ ...value, guests: n + value.children }),
    },
    {
      title: "Children",
      note: "Ages 2–12",
      label: "children",
      count: value.children,
      min: 0,
      max: unit.max_guests - adults,
      set: (n) => onChange({ ...value, children: n, guests: adults + n }),
    },
  ];
  if (unit.max_pets > 0) {
    rows.push({
      title: "Pets",
      note: unit.pet_fee > 0 ? `${money(unit.pet_fee, true)} per pet for the stay` : `Up to ${unit.max_pets}`,
      label: "pets",
      count: value.pets,
      min: 0,
      max: unit.max_pets,
      set: (n) => onChange({ ...value, pets: n }),
    });
  }
  return (
    <div className="divide-y divide-sand-200">
      {rows.map((r) => (
        <div key={r.title} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <div>
            <p className="text-sm font-medium text-ink">{r.title}</p>
            <p className="text-xs text-ink-muted">{r.note}</p>
          </div>
          <Stepper value={r.count} min={r.min} max={Math.max(r.min, r.max)} onChange={r.set} label={r.label} />
        </div>
      ))}
      <p className="pt-3 text-xs text-ink-muted">
        Up to {plural(unit.max_guests, "guest")} including children{unit.max_pets === 0 ? ". No pets, please." : "."}
      </p>
    </div>
  );
}
