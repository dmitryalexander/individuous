import { readFile, mkdir, open, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export class ServiceError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function validateCookie(value) {
  if (typeof value !== 'string' || value.length > 24000 || !value || /[^\x20-\x7e]/.test(value)) return false;
  const pairs = value.split(';').map(part => part.trim());
  if (pairs.some(part => !/^[\w-]+=[^;\s]*$/.test(part))) return false;
  const names = new Set(pairs.filter(part => part.length > part.indexOf('=') + 1).map(part => part.slice(0, part.indexOf('='))));
  return ['SAPISID', '__Secure-3PAPISID', '__Secure-1PAPISID'].some(name => names.has(name));
}

export class AccountService {
  constructor(dir, factory, normalize) {
    this.dir = dir; this.file = join(dir, 'session.json'); this.factory = factory; this.normalize = normalize;
    this.cookie = ''; this.generation = 0; this.pages = new Map(); this.mutations = Promise.resolve();
  }
  async load() {
    await mkdir(this.dir, { recursive: true });
    try {
      const data = JSON.parse(await readFile(this.file, 'utf8'));
      if (!validateCookie(data.cookie)) throw new Error('Invalid saved connection');
      this.cookie = data.cookie;
    } catch (error) { if (error.code !== 'ENOENT') console.error('Saved YouTube connection unavailable; reconnect in Menu.'); }
  }
  status() { return { connected: false, authenticated: false, has_session: !!this.cookie }; }
  mutate(run) {
    const result = this.mutations.then(run, run); this.mutations = result.catch(() => {}); return result;
  }
  async syncDirectory() { const handle = await open(this.dir, 'r'); try { await handle.sync(); } finally { await handle.close(); } }
  async persist(cookie) {
    if (!cookie) { await unlink(this.file).catch(error => { if (error.code !== 'ENOENT') throw error; }); await this.syncDirectory(); return; }
    const temp = join(this.dir, '.session-' + randomUUID());
    try {
      const handle = await open(temp, 'wx', 0o600);
      try { await handle.writeFile(JSON.stringify({ cookie })); await handle.sync(); } finally { await handle.close(); }
      await rename(temp, this.file);
      await this.syncDirectory();
    } finally { await unlink(temp).catch(() => {}); }
  }
  async verified(cookie) {
    try {
      const client = await this.factory(cookie);
      if (!await client.verify()) throw new Error('Not authenticated');
      return client;
    } catch { throw new ServiceError(401, 'YouTube could not verify this session. Check the full Cookie header or try again later.'); }
  }
  async connect(cookie) {
    if (!validateCookie(cookie)) throw new ServiceError(400, 'Paste the full YouTube Cookie header value, without the Cookie: label.');
    const generation = this.generation;
    await this.verified(cookie);
    return this.mutate(async () => {
      if (generation !== this.generation) throw new ServiceError(409, 'Connection changed. Try again.');
      await this.persist(cookie);
      this.cookie = cookie; this.generation++; this.pages.clear();
      return { connected: true, authenticated: true, has_session: true };
    });
  }
  async restore(cookie) {
    if (!validateCookie(cookie)) throw new ServiceError(400, 'The file does not contain a valid YouTube Cookie header.');
    return this.mutate(async () => {
      await this.persist(cookie);
      this.cookie = cookie; this.generation++; this.pages.clear();
      return this.status(); // Only an upstream check may mark this connected.
    });
  }
  async check() {
    const generation = this.generation, cookie = this.cookie;
    let authenticated = false;
    if (cookie) { try { await this.verified(cookie); authenticated = true; } catch {} }
    if (generation !== this.generation) throw new ServiceError(409, 'Connection changed. Check again.');
    return { connected: authenticated, authenticated, has_session: !!cookie };
  }
  async disconnect() {
    return this.mutate(async () => {
      await this.persist(''); this.cookie = ''; this.generation++; this.pages.clear();
      return this.status();
    });
  }
  async feed(cursor) {
    if (!this.cookie) throw new ServiceError(401, 'Connect your YouTube session in Menu to load your personal feed.');
    const generation = this.generation;
    let feed;
    try {
      if (cursor) {
        const page = this.pages.get(cursor);
        if (!page || page.generation !== generation || page.expires < Date.now()) throw new ServiceError(410, 'Feed expired. Refresh to start again.');
        // Share one in-flight/retried continuation instead of advancing twice.
        if (!page.next) page.next = page.feed.getContinuation().catch(error => { page.next = null; throw error; });
        feed = await page.next;
      } else {
        const client = await this.verified(this.cookie);
        feed = await client.home();
      }
      if (generation !== this.generation) throw new ServiceError(409, 'Connection changed. Refresh your feed.');
      const videos = this.normalize(feed);
      let next = null;
      if (feed.has_continuation) {
        next = randomUUID();
        this.pages.set(next, { feed, generation, expires: Date.now() + 15 * 60 * 1000 });
        while (this.pages.size > 64) this.pages.delete(this.pages.keys().next().value);
      }
      return { videos, next };
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(502, 'Your YouTube feed could not load. Check the connection in Menu and try again.');
    }
  }
}
