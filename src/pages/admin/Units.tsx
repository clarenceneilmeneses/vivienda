import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, BedDouble, ImagePlus, Pencil, Plus, Trash2, Users } from "lucide-react";
import { errorMessage, photoUrl, supabase } from "../../lib/supabase";
import { useUnits } from "../../lib/queries";
import { money } from "../../lib/format";
import { slugify } from "../../lib/utils";
import type { Unit } from "../../lib/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  Modal,
  PageHeader,
  Spinner,
  Switch,
  Textarea,
} from "../../components/ui";

export default function Units() {
  const { data: units, isLoading } = useUnits();
  const [editing, setEditing] = useState<Unit | "new" | null>(null);

  return (
    <>
      <PageHeader
        title="Rooms & rates"
        description="Weekend rates apply to Friday and Saturday nights. Set special prices per day on the Calendar."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" /> Add room
          </Button>
        }
      />
      {isLoading ? (
        <Spinner />
      ) : !units?.length ? (
        <Card>
          <EmptyState
            icon={<BedDouble className="size-8" />}
            title="No rooms yet"
            action={
              <Button onClick={() => setEditing("new")}>
                <Plus className="size-4" /> Add your first room
              </Button>
            }
          >
            Add each room, villa or cottage guests can book.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {units.map((u) => (
            <Card key={u.id} className="overflow-hidden">
              <div className="aspect-[16/9] bg-sand-100">
                {u.photos[0] ? (
                  <img src={photoUrl(u.photos[0])} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-ink-muted">
                    <BedDouble className="size-8" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{u.name}</h2>
                  {!u.is_active && <Badge>Hidden</Badge>}
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
                  <Users className="size-3.5" /> {u.capacity} included · up to {u.max_guests}
                </p>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-ink-muted">Weekday</dt>
                    <dd className="font-medium">{money(u.base_rate, true)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-muted">Fri & Sat</dt>
                    <dd className="font-medium">{money(u.weekend_rate ?? u.base_rate, true)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-muted">Extra guest</dt>
                    <dd className="font-medium">{money(u.extra_guest_fee, true)}</dd>
                  </div>
                </dl>
                <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={() => setEditing(u)}>
                  <Pencil className="size-4" /> Edit
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && <UnitModal unit={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function UnitModal({ unit, onClose }: { unit: Unit | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(unit?.name ?? "");
  const [description, setDescription] = useState(unit?.description ?? "");
  const [capacity, setCapacity] = useState(String(unit?.capacity ?? 2));
  const [maxGuests, setMaxGuests] = useState(String(unit?.max_guests ?? 4));
  const [baseRate, setBaseRate] = useState(unit ? String(unit.base_rate) : "");
  const [weekendRate, setWeekendRate] = useState(unit?.weekend_rate != null ? String(unit.weekend_rate) : "");
  const [extraFee, setExtraFee] = useState(String(unit?.extra_guest_fee ?? 0));
  const [amenities, setAmenities] = useState((unit?.amenities ?? []).join(", "));
  const [photos, setPhotos] = useState<string[]>(unit?.photos ?? []);
  const [isActive, setIsActive] = useState(unit?.is_active ?? true);
  const [sortOrder, setSortOrder] = useState(String(unit?.sort_order ?? 0));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const added: string[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name} is over 10 MB`);
        continue;
      }
      const ext = f.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${slugify(name) || "room"}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("unit-photos").upload(path, f, { contentType: f.type });
      if (error) toast.error(`${f.name}: ${error.message}`);
      else added.push(path);
    }
    setPhotos((p) => [...p, ...added]);
    setUploading(false);
  }

  function movePhoto(i: number, delta: number) {
    setPhotos((p) => {
      const next = [...p];
      const j = i + delta;
      if (j < 0 || j >= next.length) return p;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cap = Number(capacity);
    const max = Number(maxGuests);
    if (!name.trim()) return setError("Give the room a name.");
    if (!(Number(baseRate) >= 0) || baseRate === "") return setError("Set the nightly rate.");
    if (!(cap >= 1)) return setError("Included guests must be at least 1.");
    if (max < cap) return setError("Max guests can't be lower than included guests.");
    setSaving(true);
    const row = {
      name: name.trim(),
      slug: unit?.slug ?? (slugify(name) || crypto.randomUUID().slice(0, 8)),
      description: description.trim(),
      capacity: cap,
      max_guests: max,
      base_rate: Number(baseRate),
      weekend_rate: weekendRate === "" ? null : Number(weekendRate),
      extra_guest_fee: Number(extraFee) || 0,
      amenities: amenities
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
      photos,
      is_active: isActive,
      sort_order: Number(sortOrder) || 0,
    };
    const { error } = unit
      ? await supabase.from("units").update(row).eq("id", unit.id)
      : await supabase.from("units").insert(row);
    setSaving(false);
    if (error) {
      return setError(error.code === "23505" ? "Another room already has that name. Pick a different one." : errorMessage(error));
    }
    // Photos removed from the list are deleted from storage too.
    const removed = (unit?.photos ?? []).filter((p) => !photos.includes(p) && !/^https?:/.test(p));
    if (removed.length) await supabase.storage.from("unit-photos").remove(removed);
    toast.success(unit ? "Room saved" : "Room added");
    qc.invalidateQueries();
    onClose();
  }

  async function remove() {
    if (!unit) return;
    if (!confirm(`Delete ${unit.name}? This only works if it has no bookings — otherwise hide it instead.`)) return;
    const { error } = await supabase.from("units").delete().eq("id", unit.id);
    if (error) {
      toast.error(error.code === "23503" ? "This room has bookings. Switch off “Show on website” instead." : errorMessage(error));
      return;
    }
    const own = unit.photos.filter((p) => !/^https?:/.test(p));
    if (own.length) await supabase.storage.from("unit-photos").remove(own);
    toast.success("Room deleted");
    qc.invalidateQueries();
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={unit ? `Edit ${unit.name}` : "Add room"}
      footer={
        <>
          {unit && (
            <Button variant="danger" className="mr-auto" onClick={remove}>
              <Trash2 className="size-4" /> Delete
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="unit-form" loading={saving} disabled={uploading}>
            Save
          </Button>
        </>
      }
    >
      <form id="unit-form" onSubmit={save} className="space-y-5">
        <Field label="Name" hint="e.g. Garden Villa, Family Room">
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoFocus={!unit} />}
        </Field>
        <Field label="Description" optional>
          {(id) => <Textarea id={id} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />}
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Weekday rate (₱)">
            {(id) => <Input id={id} type="number" min={0} value={baseRate} onChange={(e) => setBaseRate(e.target.value)} />}
          </Field>
          <Field label="Fri & Sat rate (₱)" optional hint="Blank = same as weekday">
            {(id) => (
              <Input id={id} type="number" min={0} value={weekendRate} onChange={(e) => setWeekendRate(e.target.value)} />
            )}
          </Field>
          <Field label="Extra guest / night (₱)">
            {(id) => <Input id={id} type="number" min={0} value={extraFee} onChange={(e) => setExtraFee(e.target.value)} />}
          </Field>
          <Field label="Guests included" hint="Covered by the rate">
            {(id) => <Input id={id} type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />}
          </Field>
          <Field label="Max guests" hint="With extra guest fee">
            {(id) => <Input id={id} type="number" min={1} value={maxGuests} onChange={(e) => setMaxGuests(e.target.value)} />}
          </Field>
          <Field label="Order" hint="Lower shows first">
            {(id) => <Input id={id} type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />}
          </Field>
        </div>

        <Field label="Amenities" optional hint="Separate with commas: Aircon, Wi-Fi, Private pool, Kitchen">
          {(id) => <Input id={id} value={amenities} onChange={(e) => setAmenities(e.target.value)} />}
        </Field>

        <div>
          <p className="mb-2 text-sm font-medium">Photos</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((p, i) => (
              <div key={p} className="group relative aspect-square overflow-hidden rounded-lg bg-sand-100">
                <img src={photoUrl(p)} alt="" className="size-full object-cover" />
                {i === 0 && (
                  <span className="absolute top-1 left-1 rounded bg-ink/70 px-1.5 text-[10px] text-white">Cover</span>
                )}
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-ink/60 p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <button type="button" onClick={() => movePhoto(i, -1)} className="rounded p-1 text-white" aria-label="Move left">
                    <ArrowLeft className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotos((ps) => ps.filter((x) => x !== p))}
                    className="rounded p-1 text-white"
                    aria-label="Remove photo"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                  <button type="button" onClick={() => movePhoto(i, 1)} className="rounded p-1 text-white" aria-label="Move right">
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-sand-300 text-xs text-ink-muted hover:border-brand-500 hover:text-ink">
              <ImagePlus className="size-5" />
              {uploading ? "Uploading…" : "Add photos"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(e) => {
                  upload(e.target.files);
                  e.target.value = "";
                }}
                disabled={uploading}
              />
            </label>
          </div>
        </div>

        <Switch
          checked={isActive}
          onChange={setIsActive}
          label="Show on website"
          description="Hidden rooms can't be booked online but keep their history."
        />
        <ErrorBox>{error}</ErrorBox>
      </form>
    </Modal>
  );
}
