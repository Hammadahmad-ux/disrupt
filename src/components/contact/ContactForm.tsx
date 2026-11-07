"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CONTACT } from "./contact-details";
import { isOn } from "@/content/site";
import styles from "./contact.module.css";

const MAKING = ["CGI film", "CGI stills", "VFX", "Not sure yet"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Values = { name: string; email: string; company: string; making: string; message: string };
type Key = keyof Values;
const EMPTY: Values = { name: "", email: "", company: "", making: "", message: "" };
const ORDER: Key[] = ["name", "email", "message"];

function validate(v: Values): Partial<Record<Key, string>> {
  const e: Partial<Record<Key, string>> = {};
  if (!v.name.trim()) e.name = "Please add your name.";
  if (!v.email.trim()) e.email = "Please add an email so we can reply.";
  else if (!EMAIL_RE.test(v.email.trim())) e.email = "That email doesn't look right.";
  const msg = v.message.trim();
  if (!msg) e.message = "Tell us a little about the project.";
  else if (msg.length < 10) e.message = "A few more words, please.";
  return e;
}

function Field({
  id,
  label,
  optional,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.field} data-invalid={error ? "" : undefined}>
      <label htmlFor={id} className={styles.fieldLabel}>
        {label}
        {optional ? <span className={styles.optional}> (optional)</span> : null}
      </label>
      <div className={styles.control}>
        {children}
        <span className={styles.bar} aria-hidden="true" />
      </div>
      <p id={`${id}-error`} className={styles.error} aria-live="polite">
        {error ?? ""}
      </p>
    </div>
  );
}

// Enquiry form: validates, posts to /api/contact (emails the studio), then shows a thank-you in place.
export default function ContactForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const thanksRef = useRef<HTMLDivElement>(null);
  const startedAt = useRef(0); // when the form appeared; the server rejects instant (bot) submits
  const [values, setValues] = useState<Values>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<Key, boolean>>>({});
  const [tried, setTried] = useState(false);
  const [sent, setSent] = useState<Values | null>(null);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [formHeight, setFormHeight] = useState(0);

  const errors = validate(values);
  const errorFor = (k: Key) => ((tried || touched[k]) && errors[k]) || undefined;

  useEffect(() => {
    if (sent) thanksRef.current?.focus();
    else startedAt.current = Date.now();
  }, [sent]);

  const set = (k: Key) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const blur = (k: Key) => () => setTouched((t) => ({ ...t, [k]: true }));
  const aria = (k: Key) => ({
    "aria-invalid": errorFor(k) ? true : undefined,
    "aria-describedby": `cf-${k}-error`,
  });

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;
    setTried(true);
    const first = ORDER.find((k) => errors[k]);
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`#cf-${first}`)?.focus();
      return;
    }
    setSending(true);
    setFailed(false);
    const website = (new FormData(e.currentTarget).get("website") as string | null) ?? "";
    const ok = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, email: values.email.trim(), website, startedAt: startedAt.current }),
    })
      .then((r) => r.ok)
      .catch(() => false);
    setSending(false);
    if (!ok) return setFailed(true);
    setFormHeight(formRef.current?.offsetHeight ?? 0); // keep the panel height, so the page does not jump
    setSent(values);
  };

  const reset = () => {
    setValues(EMPTY);
    setTouched({});
    setTried(false);
    setFailed(false);
    setSent(null);
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("#cf-name")?.focus());
  };

  if (sent) {
    const firstName = sent.name.trim().split(/\s+/)[0];
    return (
      <div
        ref={thanksRef}
        className={styles.thanks}
        style={formHeight ? { minHeight: formHeight } : undefined}
        role="status"
        tabIndex={-1}
      >
        <span className={styles.thanksMark} aria-hidden="true">
          <span />
          <span />
        </span>
        <p className={`t-label ${styles.thanksLabel}`}>Message received</p>
        <h3 className={styles.thanksTitle}>Thanks, {firstName}.</h3>
        {/* CONFIRM WITH ADIL: reply wording (no promised reply time yet). */}
        <p className={styles.thanksText}>
          Your message is with the studio. We&rsquo;ll reply to <strong>{sent.email.trim()}</strong>.
        </p>
        <button type="button" className={styles.again} onClick={reset}>
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} className={styles.form} noValidate onSubmit={onSubmit} aria-labelledby="cf-title">
      <h3 id="cf-title" className={`t-label ${styles.formTitle}`}>
        Start a project
      </h3>

      <div className={styles.pair}>
        <Field id="cf-name" label="Your name" error={errorFor("name")}>
          <input
            id="cf-name"
            name="name"
            className={styles.input}
            autoComplete="name"
            placeholder="Alex Morgan"
            value={values.name}
            onChange={set("name")}
            onBlur={blur("name")}
            required
            {...aria("name")}
          />
        </Field>
        <Field id="cf-email" label="Email" error={errorFor("email")}>
          <input
            id="cf-email"
            name="email"
            type="email"
            inputMode="email"
            className={styles.input}
            autoComplete="email"
            placeholder="alex@brand.com"
            value={values.email}
            onChange={set("email")}
            onBlur={blur("email")}
            required
            {...aria("email")}
          />
        </Field>
      </div>

      <Field id="cf-company" label="Company" optional>
        <input
          id="cf-company"
          name="company"
          className={styles.input}
          autoComplete="organization"
          placeholder="Brand or agency"
          value={values.company}
          onChange={set("company")}
          aria-describedby="cf-company-error"
        />
      </Field>

      <fieldset className={styles.chips}>
        <legend className={styles.fieldLabel}>
          What are you making? <span className={styles.optional}>(optional)</span>
        </legend>
        <div className={styles.chipRow}>
          {MAKING.map((m) => (
            <label key={m} className={styles.chip}>
              <input
                type="radio"
                name="making"
                value={m}
                checked={values.making === m}
                onChange={set("making")}
              />
              <span>{m}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field id="cf-message" label="About the project" error={errorFor("message")}>
        <textarea
          id="cf-message"
          name="message"
          className={`${styles.input} ${styles.textarea}`}
          rows={4}
          value={values.message}
          onChange={set("message")}
          onBlur={blur("message")}
          required
          {...aria("message")}
        />
      </Field>

      {/* Honeypot: hidden from people and screen readers; bots that fill it are dropped server-side. */}
      <div className={styles.trap} aria-hidden="true">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <div className={styles.submitRow}>
        <p className={styles.note}>
          We only use your details to reply to you.
          {isOn("privacy") && (
            <>
              {" "}
              <a href="/privacy">Privacy</a>
            </>
          )}
        </p>
        <button type="submit" className={styles.submit} disabled={sending} aria-disabled={sending || undefined}>
          {sending ? "Sending…" : "Send message"} <span className={styles.chev} aria-hidden="true" />
        </button>
      </div>
      {failed ? (
        <p className={`${styles.error} ${styles.sendError}`} role="alert">
          Sorry, your message didn&rsquo;t send. Please email us at{" "}
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>.
        </p>
      ) : null}
    </form>
  );
}
