"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { IconProfile } from "@/components/icons";

/** Complete the basic profile and optional avatar upload (#1, step 3). */
export function ProfileSetupForm({
  initial,
}: {
  initial: { fullName: string; headline: string; bio: string; location: string; phone: string; hasAvatar: boolean };
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(initial.fullName);
  const [headline, setHeadline] = useState(initial.headline);
  const [bio, setBio] = useState(initial.bio);
  const [location, setLocation] = useState(initial.location);
  const [phone, setPhone] = useState(initial.phone);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickAvatar(file: File | null) {
    setAvatar(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("fullName", fullName);
    form.set("headline", headline);
    form.set("bio", bio);
    form.set("location", location);
    form.set("phone", phone);
    if (avatar) form.set("avatar", avatar);

    const res = await fetch("/api/onboarding/profile", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't save your profile. Please try again.");
      return;
    }
    router.push(data.redirect ?? "/student");
    router.refresh();
  }

  const inputClass =
    "mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand-1 focus:outline-2 focus:outline-brand-3";

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-3/25 text-brand-1 dark:text-brand-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <IconProfile className="h-7 w-7" />
          )}
        </span>
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:border-brand-1 hover:text-brand-1"
          >
            {initial.hasAvatar || avatar ? "Change picture" : "Upload picture"}
          </button>
          <p className="mt-1 text-xs text-text-muted">Optional · PNG, JPEG or WebP, up to 5MB.</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => pickAvatar(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      <div>
        <label htmlFor="fullName" className="block text-xs font-semibold text-text-muted">
          Full name
        </label>
        <input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="headline" className="block text-xs font-semibold text-text-muted">
          Headline
        </label>
        <input
          id="headline"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="Video editor · storyteller"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="bio" className="block text-xs font-semibold text-text-muted">
          Short bio
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          className={inputClass}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="location" className="block text-xs font-semibold text-text-muted">
            Location
          </label>
          <input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-xs font-semibold text-text-muted">
            Phone
          </label>
          <input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-1 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-2 disabled:opacity-50"
      >
        {busy ? "Finishing…" : "Finish setup"}
      </button>
    </form>
  );
}
