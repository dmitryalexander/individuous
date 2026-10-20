const { test } = require('node:test');
const assert = require('node:assert/strict');
const { destination, DEFAULTS } = require('../ui/external-tools.js');
const vm = require('node:vm');
const fs = require('node:fs');
test('red strip targets the selected video and preserves the plain downloader URL', () => {
  assert.equal(destination(DEFAULTS.transcript, 'AS92HYsEBqo'), 'https://www.youtube-transcript.io/videos?id=AS92HYsEBqo');
  assert.equal(destination(DEFAULTS.download, 'AS92HYsEBqo'), DEFAULTS.download);
  assert.equal(new URL(destination('https://example.com/?video={url}', 'AS92HYsEBqo')).searchParams.get('video'), 'https://www.youtube.com/watch?v=AS92HYsEBqo');
});
test('provider settings refuse unsafe URLs and malformed video IDs', () => {
  for (const url of ['javascript:alert(1)', 'http://example.com/', 'https://user:password@example.com/', 'https://example.com/{unknown}', '']) {
    assert.throws(() => destination(url, 'AS92HYsEBqo'));
  }
  assert.throws(() => destination(DEFAULTS.transcript, 'x&private=value'));
});
test('normal red click copies and opens downloader; Ctrl-click opens selected transcript without copying', async () => {
  const opened = [], copied = [], reported = [];
  const context = {
    URL, URLSearchParams, location: { search: '' },
    localStorage: { getItem: () => null },
    navigator: { clipboard: { writeText: async value => copied.push(value) } },
    MutationObserver: class { observe() {} },
    document: {
      documentElement: {}, readyState: 'loading', addEventListener() {},
      body: { append() {} },
      createElement() { return { click() { opened.push({href: this.href, rel: this.rel, target: this.target}); }, remove() {} }; }
    }, window: {}
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../ui/external-tools.js'), 'utf8'), context);
  context.window.ptExternalTools.open('AS92HYsEBqo', false, message => reported.push(message));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(copied[0], 'https://www.youtube.com/watch?v=AS92HYsEBqo');
  assert.equal(opened[0].href, DEFAULTS.download);
  assert.match(opened[0].rel, /noopener/);
  assert.match(reported[0], /copied/);
  context.window.ptExternalTools.open('AS92HYsEBqo', true, message => reported.push(message));
  assert.equal(copied.length, 1);
  assert.equal(opened[1].href, 'https://www.youtube-transcript.io/videos?id=AS92HYsEBqo');
  assert.equal(opened[1].target, '_blank');
});
