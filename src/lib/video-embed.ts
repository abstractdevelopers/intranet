/**
 * Video link recognition for portfolio pieces.
 *
 * Students submit video work as a hosted link (see the VIDEO submission type).
 * This turns such a link into an embeddable player plus a cover image, so a
 * portfolio piece can show the video rather than a bare URL.
 *
 * Only well-known providers are embedded. Anything else keeps its plain link —
 * guessing at an arbitrary URL risks framing a page that forbids it.
 */

export type VideoEmbed = {
  provider: "youtube" | "vimeo";
  /** Embeddable player URL. */
  embedUrl: string;
  /** Cover image, where the provider exposes a predictable one. */
  thumbnailUrl: string | null;
  /** The original link, for a "watch on …" fallback. */
  sourceUrl: string;
};

/** Extract a YouTube video id from the usual link shapes. */
function youtubeId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([\w-]{6,})/i,
    /youtube\.com\/watch\?(?:.*&)?v=([\w-]{6,})/i,
    /youtube\.com\/shorts\/([\w-]{6,})/i,
    /youtube\.com\/embed\/([\w-]{6,})/i,
    /youtube\.com\/live\/([\w-]{6,})/i,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/** Extract a Vimeo video id. */
function vimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d{6,})/i);
  return m ? m[1] : null;
}

/**
 * Parse a link into an embed. Returns null when the provider is not one we can
 * embed, in which case the caller should fall back to a plain link.
 *
 * Google Drive is deliberately NOT embedded: Drive links are frequently
 * permission-restricted and the preview iframe fails silently for the viewer,
 * which is worse than a link that explains itself.
 */
export function parseVideoEmbed(url: string | null | undefined): VideoEmbed | null {
  if (!url) return null;
  let trimmed: string;
  try {
    trimmed = url.trim();
    new URL(trimmed);
  } catch {
    return null;
  }

  const yt = youtubeId(trimmed);
  if (yt) {
    return {
      provider: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?rel=0`,
      thumbnailUrl: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
      sourceUrl: trimmed,
    };
  }

  const vm = vimeoId(trimmed);
  if (vm) {
    return {
      provider: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${vm}`,
      thumbnailUrl: null,
      sourceUrl: trimmed,
    };
  }

  return null;
}

/** Whether a project's link is an embeddable video. */
export function isVideoProjectLink(url: string | null | undefined): boolean {
  return parseVideoEmbed(url) !== null;
}
