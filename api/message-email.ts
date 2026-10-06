import { adminClient, esc, json, layout, loadSettings, p, siteUrlFrom } from "./_lib/email.js";

// Emails the other side when a message arrives in the guest ↔ resort chat.
// A guest can only ping the host about their own conversation; only the admin
// can email a guest. Each side is emailed at most once every 10 minutes per
// conversation, and a guest who has already read the reply gets no email.
const QUIET_MS = 10 * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let body: { direction?: string; conversationId?: string };
  try {
    body = await request.json();
  } catch {
    return json({ message: "Bad request" }, 400);
  }
  const direction = body.direction;
  if (direction !== "to_host" && direction !== "to_guest") return json({ message: "Bad request" }, 400);

  let db;
  try {
    db = adminClient();
  } catch (err) {
    return json({ ok: false, status: "skipped", message: (err as Error).message }, 200);
  }

  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!token) return json({ message: "Sign in first" }, 401);
  const { data: who, error: whoErr } = await db.auth.getUser(token);
  if (whoErr || !who.user) return json({ message: "Sign in first" }, 401);
  const { data: adminRow } = await db.from("admins").select("email").ilike("email", who.user.email ?? "").maybeSingle();
  const isAdmin = Boolean(adminRow);

  let conversation: Record<string, string | null> | null = null;
  if (direction === "to_host") {
    const { data: guest } = await db.from("guests").select("id").eq("user_id", who.user.id).maybeSingle();
    if (!guest) return json({ message: "Not allowed" }, 403);
    const { data } = await db.from("conversations").select("*").eq("guest_id", guest.id).maybeSingle();
    conversation = data;
  } else {
    if (!isAdmin || !UUID.test(String(body.conversationId ?? ""))) return json({ message: "Not allowed" }, 403);
    const { data } = await db.from("conversations").select("*").eq("id", body.conversationId).maybeSingle();
    conversation = data;
  }
  if (!conversation) return json({ message: "Conversation not found" }, 404);

  const sentAt = direction === "to_host" ? conversation.host_emailed_at : conversation.guest_emailed_at;
  if (sentAt && Date.now() - new Date(sentAt).getTime() < QUIET_MS) {
    return json({ ok: true, status: "skipped", message: "Emailed recently" });
  }

  const { data: guest } = await db
    .from("guests")
    .select("full_name, email")
    .eq("id", conversation.guest_id)
    .single();
  const { data: latest } = await db
    .from("messages")
    .select("author, body, sent_at")
    .eq("conversation_id", conversation.id)
    .is("unsent_at", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const wantAuthor = direction === "to_host" ? "guest" : "host";
  if (!latest || latest.author !== wantAuthor) return json({ ok: true, status: "skipped", message: "Nothing new" });
  if (Date.now() - new Date(latest.sent_at).getTime() > 5 * 60_000) {
    return json({ ok: true, status: "skipped", message: "Too old" });
  }
  if (
    direction === "to_guest" &&
    conversation.guest_seen_at &&
    new Date(conversation.guest_seen_at) >= new Date(latest.sent_at)
  ) {
    return json({ ok: true, status: "skipped", message: "Guest already read it" });
  }

  const s = await loadSettings(db);
  const site = siteUrlFrom(request);
  const to = direction === "to_host" ? s.admin_notify_email || s.email : guest?.email;
  const type = direction === "to_host" ? "message_to_host" : "message_to_guest";
  const log = (status: "sent" | "skipped" | "failed", error?: string) =>
    db.from("email_log").insert({ booking_id: null, type, to_email: to || "—", status, error: error ?? null });

  if (!to) {
    await log("skipped", "No email address to send to.");
    return json({ ok: true, status: "skipped" });
  }
  if (direction === "to_guest" && !s.send_emails) {
    await log("skipped", "Guest emails are turned off in Settings.");
    return json({ ok: true, status: "skipped" });
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    await log("skipped", "Email isn't set up yet (RESEND_API_KEY missing).");
    return json({ ok: true, status: "skipped" });
  }

  const quote = `<blockquote style="margin:0 0 12px;padding:12px 16px;border-left:3px solid #7b4821;background:#fbfaf8;font-size:15px;line-height:1.6;color:#3d3d3d;white-space:pre-line">${esc(
    latest.body.length > 600 ? `${latest.body.slice(0, 600)}…` : latest.body,
  )}</blockquote>`;
  const email =
    direction === "to_host"
      ? {
          subject: `New message from ${guest?.full_name ?? "a guest"}`,
          html: layout(s, `${guest?.full_name ?? "A guest"} sent you a message`, quote, {
            href: `${site}/admin/inbox?c=${conversation.id}`,
            label: "Reply in the inbox",
          }),
        }
      : {
          subject: `New message from ${s.resort_name}`,
          html: layout(
            s,
            `${s.resort_name} replied to you`,
            p(`Hi ${esc((guest?.full_name ?? "").split(" ")[0] || "there")},`) + quote,
            { href: `${site}/messages`, label: "Open your messages" },
          ),
        };

  const from = process.env.EMAIL_FROM || `${s.resort_name} <onboarding@resend.dev>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: email.subject, html: email.html }),
    });
    if (!res.ok) {
      await log("failed", (await res.text()).slice(0, 500));
      return json({ ok: false, status: "failed" }, 502);
    }
  } catch (err) {
    await log("failed", err instanceof Error ? err.message : String(err));
    return json({ ok: false, status: "failed" }, 502);
  }
  await log("sent");
  await db
    .from("conversations")
    .update(direction === "to_host" ? { host_emailed_at: new Date().toISOString() } : { guest_emailed_at: new Date().toISOString() })
    .eq("id", conversation.id);
  return json({ ok: true, status: "sent" });
}
