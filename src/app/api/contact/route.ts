import nodemailer from "nodemailer";
import { z } from "zod";

// Contact form endpoint: validate, drop obvious spam, email the studio with Resend (RESEND_API_KEY) or, if that
// is not set, through a mailbox (SMTP_USER / SMTP_PASS).
const TO = process.env.CONTACT_TO || "contact@disruptstudio.co.uk";
const MIN_FILL_MS = 3000;

const Enquiry = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().pipe(z.email().max(200)),
  company: z.string().trim().max(160).default(""),
  making: z.string().trim().max(40).default(""),
  message: z.string().trim().min(10).max(5000),
  website: z.string().default(""), // honeypot: humans never see it
  startedAt: z.number().default(0), // when the form rendered (ms)
});

// Small in-memory per-IP limit (per server instance; enough to slow down a script).
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (limited(ip)) return Response.json({ ok: false, error: "rate" }, { status: 429 });

  const parsed = Enquiry.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  const { name, email, company, making, message, website, startedAt } = parsed.data;

  // Bots: pretend it worked so they do not retry.
  if (website || Date.now() - startedAt < MIN_FILL_MS) return Response.json({ ok: true });

  const rows: [string, string][] = [
    ["Name", name],
    ["Email", email],
    ["Company", company || "-"],
    ["Making", making || "-"],
  ];
  const text = `${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${message}`;
  const html =
    rows.map(([k, v]) => `<p><strong>${k}:</strong> ${esc(v)}</p>`).join("") +
    `<p style="white-space:pre-wrap">${esc(message)}</p>`;

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const subject = `New enquiry from ${name.replace(/[\r\n]+/g, " ")}`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM || "DISRUPT website <onboarding@resend.dev>",
        to: [TO],
        reply_to: email,
        subject,
        text,
        html,
      }),
    }).catch(() => null);
    if (!res?.ok) {
      console.error("contact: Resend failed", res?.status, await res?.text().catch(() => ""));
      return Response.json({ ok: false, error: "send" }, { status: 502 });
    }
    return Response.json({ ok: true });
  }

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    if (process.env.NODE_ENV === "production") {
      console.error("contact: neither RESEND_API_KEY nor SMTP_USER / SMTP_PASS is set");
      return Response.json({ ok: false, error: "unconfigured" }, { status: 503 });
    }
    console.log(`contact (dev, not sent):\n${text}`);
    return Response.json({ ok: true });
  }

  const port = Number(process.env.SMTP_PORT) || 465;
  try {
    await nodemailer
      .createTransport({
        host: process.env.SMTP_HOST || "smtp.hostinger.com",
        port,
        secure: port === 465,
        auth: { user, pass },
        connectionTimeout: 10_000,
        socketTimeout: 15_000,
      })
      .sendMail({
        from: process.env.CONTACT_FROM || `DISRUPT website <${user}>`,
        to: TO,
        replyTo: email,
        subject: `New enquiry from ${name.replace(/[\r\n]+/g, " ")}`,
        text,
        html,
      });
  } catch (err) {
    console.error("contact: SMTP failed", err instanceof Error ? err.message : err);
    return Response.json({ ok: false, error: "send" }, { status: 502 });
  }
  return Response.json({ ok: true });
}
