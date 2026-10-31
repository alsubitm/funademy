/** Shared by the family player and author preview: preview exactly what families get. */
export function safeHttpUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch { return null; }
}

export function toYoutubeEmbed(raw: string): string | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '');
    const id = host === 'youtu.be'
      ? url.pathname.slice(1).split('/')[0]
      : ['youtube.com', 'm.youtube.com'].includes(host)
        ? (url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/embed\/([^/]+)/)?.[1])
        : null;
    return id && /^[A-Za-z0-9_-]{11}$/.test(id)
      ? `https://www.youtube-nocookie.com/embed/${id}?rel=0`
      : null;
  } catch { return null; }
}

export function toVimeoEmbed(raw: string): string | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '');
    if (!['vimeo.com', 'player.vimeo.com'].includes(host)) return null;
    const id = url.pathname.match(/(?:\/video)?\/(\d+)(?:\/|$)/)?.[1];
    return id ? `https://player.vimeo.com/video/${id}` : null;
  } catch { return null; }
}
