"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Avatar } from "@/components/creators/avatar";

/** Edit the public creator profile after setup (#1, #2). */
export function ProfileEditor({
  initial,
  canChangeUsername,
}: {
  initial: {
    username: string;
    fullName: string;
    headline: string;
    bio: string;
    location: string;
    phone: string;
    avatarDocumentId: string | null;
  };
  canChangeUsername: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState(initial.username);
  const [fullName, setFullName] = useState(initial.fullName);
  const [headline, setHeadline] = useState(initial.headline);
  const [bio, setBio] = useState(initial.bio);
  const [location, setLocation] = useState(initial.location);
  const [phone, setPhone] = useState(initial.phone);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function pickAvatar(file: File | null) {
    setAvatar(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);

    const form = new FormData();
    form.set("fullName", fullName);
    form.set("headline", headline);
    form.set("bio", bio);
    form.set("location", location);
    form.set("phone", phone);
    if (username !== initial.username) form.set("username", username);
    if (avatar) form.set("avatar", avatar);

    const res = await fetch("/api/student/profile", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "We couldn't save your profile. Please try again.");
      return;
    }
    setSaved(true);
    setAvatar(null);
    setPreview(null);
    router.refresh();
  }

  const inputClass =
    "mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand-1 focus:outline-2 focus:outline-brand-3";

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex items-center gap-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            className="h-20 w-20 shrink-0 rounded-full object-cover ring-1 ring-inset ring-brand-1/15"
          />
        ) : (
          <Avatar documentId={initial.avatarDocumentId} name={initial.fullName} size="lg" />
        )}
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:border-brand-1 hover:text-brand-1"
          >
            {initial.avatarDocumentId || avatar ? "Change picture" : "Upload picture"}
          </button>
          <p className="mt-1 text-xs text-text-muted">PNG, JPEG or WebP, up to 5MB.</p>
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
        <label htmlFor="pe-username" className="block text-xs font-semibold text-text-muted">
          Username
        </label>
        <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 focus-within:border-brand-1">
          <span className="text-sm text-text-muted">@</span>
          <input
            id="pe-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={!canChangeUsername}
            spellCheck={false}
            className="w-full bg-transparent text-sm focus:outline-none disabled:opacity-60"
          />
        </div>
        <p className="mt-1 text-xs text-text-muted">
          {canChangeUsername
            ? "This is your public identity. It can only be changed once every two weeks."
            : "You changed your username recently — you'll be able to change it again soon."}
        </p>
      </div>

      <div>
        <label htmlFor="pe-name" className="block text-xs font-semibold text-text-muted">
          Full name
        </label>
        <input
          id="pe-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="pe-headline" className="block text-xs font-semibold text-text-muted">
          Headline
        </label>
        <input
          id="pe-headline"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="Video editor · storyteller"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="pe-bio" className="block text-xs font-semibold text-text-muted">
          Bio
        </label>
        <textarea
          id="pe-bio"
          rows={4}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="What do you make? What are you working towards?"
          className={inputClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pe-location" className="block text-xs font-semibold text-text-muted">
            Location
          </label>
          <input
            id="pe-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="pe-phone" className="block text-xs font-semibold text-text-muted">
            Phone
          </label>
          <input
            id="pe-phone"
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
      {saved && !error ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
          Your profile is saved.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-1 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-2 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
