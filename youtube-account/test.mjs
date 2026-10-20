import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AccountService, validateCookie } from './service.mjs';
import { serverFor } from './http.mjs';
import { normalizeVideos, youtubeFetch, createYouTube } from './upstream.mjs';

const COOKIE = 'SAPISID=synthetic; SID=test';
test('hash export and offline restore are explicit, protected and never mark auth verified', async t => {
  const service = await fixture(t, async () => { throw Error('Offline'); });
  await service.restore(COOKIE);
  assert.deepEqual(service.status(), { connected: false, authenticated: false, has_session: true });
  const server = serverFor(service); await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => server.close(r)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const send = (path, origin, body) => fetch(base + path, {method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body || {})});
  assert.equal((await send('/export', 'https://foreign.test')).status,403);
  const backup = await (await send('/export',base)).json();
  assert.equal(backup.app,'individuous'); assert.equal(backup.credentials.cookie,COOKIE);
  await service.disconnect();
  assert.equal((await send('/restore',base,backup.credentials)).status,200);
  assert.equal(service.cookie,COOKIE);
  assert.equal((await send('/restore',base,{cookie:'invalid'})).status,400);
  assert.equal(service.cookie,COOKIE);
  assert.equal(JSON.stringify(await service.check()).includes(COOKIE),false);
});
async function fixture(t, factory) {
  const dir = await mkdtemp(join(tmpdir(), 'individuous-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const service = new AccountService(dir, factory || (async () => ({ verify: async () => true, home: async () => ({ videos: [], has_continuation: false }) })), normalizeVideos);
  await service.load(); return service;
}
test('private connection survives restart; checks never replace credentials; disconnect removes it', async t => {
  let valid = true;
  const service = await fixture(t, async () => ({ verify: async () => valid }));
  await service.connect(COOKIE);
  assert.equal((await stat(service.file)).mode & 0o777, 0o600);
  const restarted = new AccountService(service.dir, service.factory, normalizeVideos); await restarted.load();
  assert.deepEqual(restarted.status(), { connected: false, authenticated: false, has_session: true });
  assert.deepEqual(await restarted.check(), { connected: true, authenticated: true, has_session: true });
  assert.equal(JSON.stringify(restarted.status()).includes('synthetic'), false);
  valid = false;
  assert.deepEqual(await restarted.check(), { connected: false, authenticated: false, has_session: true });
  await assert.rejects(restarted.connect('SAPISID=bad'), { status: 401 });
  assert.equal(JSON.parse(await readFile(service.file, 'utf8')).cookie, COOKIE);
  await restarted.disconnect();
  await assert.rejects(stat(service.file), { code: 'ENOENT' });
  assert.deepEqual(restarted.status(), { connected: false, authenticated: false, has_session: false });
});
test('validation refuses headers, CRLF, arbitrary values and empty auth cookies', () => {
  for (const cookie of ['Cookie: ' + COOKIE, 'SAPISID=x\r\nHost: evil.test', 'foo=x', '', 'SAPISID=']) assert.equal(validateCookie(cookie), false);
  assert.equal(validateCookie(COOKIE), true);
});
test('disconnect wins verification in progress; failed persistence keeps old connection', async t => {
  let resolve, started;
  const waiting = new Promise(r => { started = r; });
  const service = await fixture(t, async () => ({ verify: () => new Promise(r => { resolve = r; started(); }) }));
  const connecting = service.connect(COOKIE);
  await waiting; await service.disconnect(); resolve(true);
  await assert.rejects(connecting, { status: 409 });
  service.cookie = COOKIE; service.factory = async () => ({ verify: async () => true }); service.file = join(service.dir, 'missing', 'session.json');
  await assert.rejects(service.connect('SAPISID=replacement'));
  assert.equal(service.cookie, COOKIE);
});
test('feed continues with bounded opaque cursors and invalidates on disconnect', async t => {
  let calls = 0;
  const second = { videos: [{ id: 'bbbbbbbbbbb', title: 'Second' }], has_continuation: false };
  const first = { videos: [{ content_id: 'aaaaaaaaaaa', metadata: { title: '<unsafe>' } }, { id: 'aaaaaaaaaaa' }, { id: 'bad<script>' }], has_continuation: true, getContinuation: async () => { calls++; return second; } };
  const service = await fixture(t, async () => ({ verify: async () => true, home: async () => first }));
  await service.connect(COOKIE);
  const result = await service.feed(); assert.equal(result.videos.length, 1); assert.equal(result.videos[0].title, '<unsafe>'); assert(result.next);
  const [a,b] = await Promise.all([service.feed(result.next), service.feed(result.next)]);
  assert.deepEqual(a,b); assert.equal(calls, 1); assert.equal(a.next, null);
  await assert.rejects(service.feed('arbitrary'), { status: 410 });
  await service.disconnect(); await assert.rejects(service.feed(result.next), { status: 401 });
});
test('HTTP protects session mutations and personal feed; status never exposes the cookie', async t => {
  let valid = true;
  const service = await fixture(t, async () => ({ verify: async () => valid, home: async () => ({ videos: [], has_continuation: false }) })); const server = serverFor(service); await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => server.close(r)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const send = (path, options={}) => fetch(base + path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  assert.equal((await send('/session', { method: 'POST', body: JSON.stringify({ cookie: COOKIE }) })).status, 403);
  assert.equal((await send('/feed')).status, 403);
  assert.equal((await send('/session', { method: 'POST', headers: { Origin: base }, body: JSON.stringify({ cookie: COOKIE }) })).status, 200);
  assert.equal((await send('/session')).status, 200);
  assert.equal((await (await send('/session')).text()).includes('synthetic'), false);
  assert.equal((await send('/feed', { headers: { Origin: base } })).status, 200);
  valid = false;
  assert.deepEqual(await (await send('/session')).json(), { connected: false, authenticated: false, has_session: true });
  assert.equal((await send('/session', { method:'DELETE',headers:{Origin:'https://foreign.test'} })).status,403);
});
test('credential transport rejects redirects destinations, arbitrary hosts and writes', async () => {
  for (const url of ['https://evil.test/youtubei/v1/browse', 'http://www.youtube.com/youtubei/v1/browse', 'https://www.youtube.com:4430/youtubei/v1/browse', 'https://www.youtube.com/youtubei/v1/like/like']) await assert.rejects(youtubeFetch(url));
});
test('actual YouTube.js account and modern home-feed parser with synthetic HTTP responses', async () => {
  let authenticated = true;
  const paths = [];
  const client = await createYouTube(COOKIE, async (input) => {
    const url = new URL(typeof input === 'string' ? input : input.url || input); paths.push(url.pathname);
    if (url.pathname === '/sw.js_data') return new Response('', { status: 500 });
    if (url.pathname === '/youtubei/v1/config') return Response.json({ responseContext: {} });
    if (url.pathname === '/youtubei/v1/account/accounts_list') return Response.json({ actions: authenticated ? [{ accountItem: {
      accountName: { simpleText: 'Synthetic account' }, isSelected: true, accountPhoto: { thumbnails: [] }, serviceEndpoint: {}, accountByline: { simpleText: '' }, channelHandle: { simpleText: '' }
    } }] : [] });
    if (url.pathname === '/youtubei/v1/browse') return Response.json({ contents: { twoColumnBrowseResultsRenderer: { tabs: [{ tabRenderer: { selected: true, content: { richGridRenderer: { contents: [{ richItemRenderer: { content: { lockupViewModel: {
      contentId: 'aaaaaaaaaaa', contentType: 'LOCKUP_CONTENT_TYPE_VIDEO', metadata: { lockupMetadataViewModel: { title: { content: 'Personal feed fixture' } } }
    } } } }] } } } }] } } });
    throw new Error('Unexpected endpoint');
  });
  assert.equal(await client.verify(), true);
  const result = normalizeVideos(await client.home());
  assert.equal(result[0].videoId, 'aaaaaaaaaaa'); assert.equal(result[0].title, 'Personal feed fixture');
  authenticated = false; assert.equal(await client.verify(), false);
  assert(paths.includes('/youtubei/v1/browse'));
});
