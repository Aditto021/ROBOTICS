import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";

type Status = "idle" | "submitting" | "success" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function encodeForm(data: Record<string, string>): string {
  return Object.keys(data)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
    .join("&");
}

export function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Name is required.";
    if (!email.trim()) next.email = "Email is required.";
    else if (!EMAIL_RE.test(email)) next.email = "Enter a valid email address.";
    if (!message.trim()) next.message = "Message is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Honeypot: bots fill every field, humans never see this one.
    if (honeypot) {
      setStatus("success");
      return;
    }

    if (!validate()) return;

    setStatus("submitting");
    try {
      const response = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: encodeForm({ "form-name": "contact", name, email, message }),
      });

      if (!response.ok) throw new Error(`Submission failed (${response.status})`);

      setStatus("success");
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      setStatus("error");
    }
  };

  return (
    <section id="contact" className="relative py-28 lg:py-36">
      <div className="mx-auto max-w-3xl px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.7 }}
          className="mx-auto mb-14 max-w-2xl text-center"
        >
          <p className="mb-4 font-mono text-xs tracking-[0.25em] text-orange">
            [ 08 — CONTACT ]
          </p>
          <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Get in touch
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            Questions about ResQBot, our research, or the team? Send a
            message below.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.7 }}
          name="contact"
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-5"
        >
          {/* Required by Netlify's static form detection; mirrors the fields below. */}
          <input type="hidden" name="form-name" value="contact" />

          <div className="hidden" aria-hidden="true">
            <label>
              Don't fill this out if you're human:
              <input
                name="bot-field"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </label>
          </div>

          <div>
            <label htmlFor="contact-name" className="mb-2 block font-mono text-xs tracking-widest text-muted">
              NAME
            </label>
            <input
              id="contact-name"
              name="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-line/15 bg-transparent px-4 py-3 text-paper outline-none transition-colors focus:border-cyan/60"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "contact-name-error" : undefined}
            />
            {errors.name && (
              <p id="contact-name-error" className="mt-1.5 text-xs text-orange">
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="contact-email" className="mb-2 block font-mono text-xs tracking-widest text-muted">
              EMAIL
            </label>
            <input
              id="contact-email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-line/15 bg-transparent px-4 py-3 text-paper outline-none transition-colors focus:border-cyan/60"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "contact-email-error" : undefined}
            />
            {errors.email && (
              <p id="contact-email-error" className="mt-1.5 text-xs text-orange">
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="contact-message" className="mb-2 block font-mono text-xs tracking-widest text-muted">
              MESSAGE
            </label>
            <textarea
              id="contact-message"
              name="message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full resize-none border border-line/15 bg-transparent px-4 py-3 text-paper outline-none transition-colors focus:border-cyan/60"
              aria-invalid={Boolean(errors.message)}
              aria-describedby={errors.message ? "contact-message-error" : undefined}
            />
            {errors.message && (
              <p id="contact-message-error" className="mt-1.5 text-xs text-orange">
                {errors.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={status === "submitting"}
            className="mt-2 self-start bg-cyan px-7 py-3.5 font-display text-sm font-medium tracking-wide text-inverse transition-colors hover:bg-white disabled:opacity-50"
          >
            {status === "submitting" ? "SENDING…" : "SEND MESSAGE"}
          </button>

          <div aria-live="polite">
            {status === "success" && (
              <p className="font-mono text-xs tracking-wide text-cyan">
                Message sent. Thanks — we'll get back to you soon.
              </p>
            )}
            {status === "error" && (
              <p className="font-mono text-xs tracking-wide text-orange">
                Something went wrong sending your message. Please try again,
                or reach out directly if this keeps happening.
              </p>
            )}
          </div>
        </motion.form>
      </div>
    </section>
  );
}
