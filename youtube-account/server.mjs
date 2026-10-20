import { AccountService } from './service.mjs';
import { createYouTube, normalizeVideos } from './upstream.mjs';
import { serverFor } from './http.mjs';
const service = new AccountService('/data', createYouTube, normalizeVideos);
await service.load();
const server = serverFor(service);
server.requestTimeout = 45000;
server.listen(8080, '0.0.0.0');
