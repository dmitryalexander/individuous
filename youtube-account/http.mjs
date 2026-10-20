import { createServer } from 'node:http';
import { ServiceError } from './service.mjs';

export function handler(service) {
  return async (req, res) => {
    const reply = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(body)); };
    try {
      let origin;
      try { origin = new URL('http://' + req.headers.host); } catch { throw new ServiceError(403, 'Open Individuous on localhost.'); }
      if (!['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) || origin.username || origin.password || origin.pathname !== '/') throw new ServiceError(403, 'Open Individuous on localhost.');
      const url = new URL(req.url, origin);
      if (req.method === 'GET' && url.pathname === '/session') return reply(200, await service.check());
      // Personal feed requests also require same-origin fetches; do not expose account data to cross-site GETs.
      if (req.headers.origin !== origin.origin && !(req.method === 'GET' && req.headers['sec-fetch-site'] === 'same-origin')) throw new ServiceError(403, 'Use the controls in Individuous.');
      if (req.method === 'GET' && url.pathname === '/feed') return reply(200, await service.feed(url.searchParams.get('cursor')));
      if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw new ServiceError(403, 'Use the controls in Individuous.');
      if (req.method === 'DELETE' && url.pathname === '/session') return reply(200, await service.disconnect());
      if (req.method === 'POST' && url.pathname === '/export') {
        if (!service.cookie) throw new ServiceError(404, 'No hash is saved.');
        return reply(200, { format: 'myapps-hash', version: 1, app: 'individuous', credentials: { cookie: service.cookie } });
      }
      if (req.method !== 'POST' || !['/session', '/check', '/restore'].includes(url.pathname)) return reply(405, { message: 'Method unavailable.' });
      let text = '';
      for await (const part of req) { text += part.toString(); if (text.length > 26000) throw new ServiceError(413, 'Session value is too long.'); }
      let data; try { data = JSON.parse(text); } catch { throw new ServiceError(400, 'Invalid request.'); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ServiceError(400, 'Invalid request.');
      if (url.pathname === '/check') return reply(200, await service.check());
      if (Object.keys(data).length !== 1 || !Object.hasOwn(data, 'cookie')) throw new ServiceError(400, 'Enter the Cookie header value only.');
      return reply(200, url.pathname === '/restore' ? await service.restore(data.cookie) : await service.connect(data.cookie));
    } catch (error) { reply(error instanceof ServiceError ? error.status : 500, { message: error instanceof ServiceError ? error.message : 'Connection service unavailable. Try again.' }); }
  };
}
export const serverFor = service => createServer(handler(service));
