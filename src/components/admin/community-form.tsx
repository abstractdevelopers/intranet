"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const PLATFORMS = ["WHATSAPP", "TELEGRAM", "DISCORD", "OTHER"] as const;

/** Add a community link, optionally scoped to a pathway (#15, #16). */
export function CommunityForm({ pathways }: { pathways: { value: string; label: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState<string>("WHATSAPP");
  const [url, setUrl] = useState("");
  const [pathway, setPathway] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/admin/communities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || undefined,
        platform,
        url,
        pathway: pathway || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't add that community. Please try again.");
      return;
    }
    setName("");
    setDescription("");
    setUrl("");
    setPathway("");
    setSaved(true);
    router.refresh();
  }

  const inputClass =
    "mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand-1 focus:outline-2 focus:outline-brand-3";

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className="block text-xs font-semibold text-text-muted">
            Name
          </label>
          <input
            id="c-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Video Editing Community"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="c-pathway" className="block text-xs font-semibold text-text-muted">
            Pathway
          </label>
          <select
            id="c-pathway"
            value={pathway}
            onChange={(e) => setPathway(e.target.value)}
            className={inputClass}
          >
            <option value="">General UCA community (everyone)</option>
            {pathways.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div>
          <label htmlFor="c-url" className="block text-xs font-semibold text-text-muted">
            Invite link
          </label>
          <input
            id="c-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            placeholder="https://chat.whatsapp.com/…"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="c-platform" className="block text-xs font-semibold text-text-muted">
            Platform
          </label>
          <select
            id="c-platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className={inputClass}
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="c-desc" className="block text-xs font-semibold text-text-muted">
          Description (optional)
        </label>
        <input
          id="c-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
        />
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {saved && !error ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">Community added.</p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-1 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-2 disabled:opacity-50"
      >
        {busy ? "Adding…" : "Add community"}
      </button>
    </form>
  );
}