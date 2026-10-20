import { Innertube, Log } from 'youtubei.js';
Log.setLevel(Log.Level.NONE);

// Credentials never leave YouTube's read-only session/account/browse endpoints.
export async function youtubeFetch(input, init = {}) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  const allowed = url.protocol === 'https:' && url.hostname === 'www.youtube.com' && !url.port && !url.username && !url.password &&
    ['/sw.js_data', '/youtubei/v1/config', '/youtubei/v1/account/accounts_list', '/youtubei/v1/browse'].includes(url.pathname);
  if (!allowed) throw new Error('Destination refused');
  const response = await fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(20000) });
  return response;
}

export async function createYouTube(cookie, fetchFunction = youtubeFetch) {
  const client = await Innertube.create({ cookie, retrieve_player: false, enable_session_cache: false, fetch: fetchFunction });
  return {
    async verify() {
      // Cookie presence is not proof of authentication: require YouTube's account response.
      const accounts = await client.account.getInfo(true);
      return accounts.some(account => account.is_selected && !account.is_disabled && String(account.account_name || '').trim());
    },
    home: () => client.getHomeFeed()
  };
}

export function normalizeVideos(feed) {
  const seen = new Set(), videos = [];
  for (const item of feed.videos || []) {
    const id = item.id || item.content_id;
    if (!/^[\w-]{11}$/.test(id || '') || seen.has(id)) continue;
    seen.add(id);
    const title = String(item.title || item.metadata?.title || 'Video').slice(0, 1000);
    const parts = (item.metadata?.metadata?.metadata_rows || []).flatMap(row => row.metadata_parts || []);
    const byline = parts.find(part => part.text?.runs?.some(run => /^UC[\w-]{22}$/.test(run.endpoint?.payload?.browseId || '')))?.text;
    const author = String(item.author?.name || byline || '').slice(0, 300);
    const channel = item.author?.id || byline?.runs?.find(run => run.endpoint?.payload?.browseId)?.endpoint.payload.browseId;
    const authorId = /^UC[\w-]{22}$/.test(channel || '') ? channel : '';
    const seconds = Number(item.duration?.seconds);
    videos.push({ videoId: id, title, author, authorId,
      lengthSeconds: Number.isFinite(seconds) && seconds > 0 ? seconds : 0 });
    if (videos.length >= 100) break;
  }
  return videos;
}
