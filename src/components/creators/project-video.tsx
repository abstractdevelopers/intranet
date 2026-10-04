"use client";

import { useState } from "react";
import { parseVideoEmbed } from "@/lib/video-embed";

/**
 * A video portfolio piece: cover image with a play button, expanding to an
 * inline player on click.
 *
 * The player is only mounted once the viewer asks for it. A profile can hold
 * many pieces, and mounting an iframe per piece would load several players at
 * once — slow, and noisy for anyone who did not ask to watch.
 */
export function ProjectVideo({
  url,
  title,
}: {
  url: string;
  title: string;
}) {
  const [playing, setPlaying] = useState(false);
  const embed = parseVideoEmbed(url);
  if (!embed) return null;

  const providerLabel = embed.provider === "youtube" ? "YouTube" : "Vimeo";

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border bg-ink">
      {playing ? (
        <div className="relative aspect-video">
          <iframe
            src={`${embed.embedUrl}${embed.embedUrl.includes("?") ? "&" : "?"}autoplay=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play ${title} on ${providerLabel}`}
          className="group relative block w-full"
        >
          <div className="relative aspect-video w-full">
            {embed.thumbnailUrl ? (
              // Provider thumbnails are remote URLs, so next/image would need
              // every host allow-listed; a plain img is the right tool here.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={embed.thumbnailUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-brand-1/40 to-brand-2/40" />
            )}
            <span className="absolute inset-0 bg-ink/25 transition-colors group-hover:bg-ink/10" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 shadow-lg transition-transform group-hover:scale-105">
                <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6 fill-brand-1" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </span>
          </div>
          <span className="absolute bottom-2 right-2 rounded bg-ink/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            {providerLabel}
          </span>
        </button>
      )}
    </div>
  );
}
