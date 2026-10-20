/* Optional personal home feed. Account/session data stays in the local service. */
;(() => {
  'use strict';
  window.ptYouTubeConnectionVersion = 9;
  const FEED = '/search?pt_page=youtube', MENU = '/feed/subscriptions?pt_page=menu';
  const KEY = 'individuous-youtube-revision';
  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; };
  async function request(path, method = 'GET', body, signal) {
    const response = await fetch('/youtube-account/' + path, { method, credentials: 'same-origin', cache: 'no-store', signal,
      ...(method === 'GET' ? {} : { headers: { 'Content-Type': 'application/json' } }),
      ...(body ? { body: JSON.stringify(body) } : {}) });
    let data; try { data = await response.json(); } catch { throw Error('YouTube connection service unavailable. Try again.'); }
    if (!response.ok) throw Error(data.message || 'YouTube connection unavailable.');
    return data;
  }
  let indicatorRevision = 0;
  function indicator(data) {
    indicatorRevision++;
    document.documentElement.setAttribute('data-youtube-authenticated', String(data?.connected === true && data?.authenticated === true));
  }
  async function checkIndicator() {
    indicator(null);
    const at = indicatorRevision;
    try { const data = await request('session'); if (at === indicatorRevision) indicator(data); } catch { if (at === indicatorRevision) indicator(null); }
  }
  function changed() {
    try { localStorage.setItem(KEY, crypto.randomUUID()); } catch {}
    window.dispatchEvent(new Event('youtube-connection-changed'));
  }
  window.addEventListener('storage', event => { if (event.key === KEY) window.dispatchEvent(new Event('youtube-connection-changed')); });

  function menu(main) {
    if (main.querySelector('.pt-youtube-connection')) return;
    const section = el('section', '', 'pt-youtube-connection');
    section.append(el('h2', 'YouTube connection'), el('p', 'Bring your personal YouTube home recommendations into Individuous. Save, hide, shuffle and play them with the usual controls.'));
    const login = el('a', 'Log in on YouTube'); login.href = 'https://www.youtube.com/'; login.target = '_blank'; login.rel = 'noopener noreferrer';
    const details = el('details'), steps = el('ol'); details.append(el('summary', 'How to connect your session'));
    for (const text of [
      'Open a private browser window and log into your YouTube account there.',
      'Press F12, select Network (1), and reload YouTube so requests appear.',
      'Click the magnifying-glass Search button in the Network toolbar. In the Search sidebar, search for cookie (2). This is the Search sidebar, not the request-list Filter field.',
      'In those search results, open a generate_204 entry under www.youtube.com (3). Skip JavaScript matches such as base.js. Select the matching request if needed.',
      'Select Headers and scroll to Request headers. Confirm :authority is www.youtube.com and :path is /generate_204. Find Cookie (4), right-click its value and choose Copy value.',
      'Paste the entire copied Cookie value below, without the Cookie: label. YouTube needs several cookies together, rather than one hash.',
      'Click Connect and check, then close the private window. Open Your YouTube feed below.'
    ]) steps.append(el('li', text));
    details.append(steps, el('p', 'Paste the session only into your own local Individuous. The field clears after submission; the saved value stays in this installation.'));
    details.append(el('p', 'If you see “Provisional headers are shown” or no Cookie entry, choose another completed generate_204 result. If needed, reload YouTube and search again.'));
    const helpLink = el('a'); helpLink.className = 'pt-help-image-link'; helpLink.href = '/youtube-session-help.png'; helpLink.target = '_blank'; helpLink.rel = 'noopener noreferrer'; helpLink.title = 'Open helper image in a new tab';
    const help = el('img'); help.src = '/youtube-session-help.png'; help.alt = 'YouTube DevTools guide: 1 Network, 2 Search for cookie, 3 open a generate_204 result, 4 copy Cookie under Request headers. Session values are hidden.'; help.loading = 'lazy';
    helpLink.append(help); details.append(helpLink, el('p', 'Click the image to enlarge. All session values in this example are hidden.'));
    const status = el('p', 'Checking connection…'); status.setAttribute('role', 'status');
    const form = el('form'); form.autocomplete = 'off';
    const label = el('label', 'YouTube session (full Cookie header value)'), input = el('input');
    input.name = 'cookie'; input.type = 'password'; input.required = true; input.maxLength = 24000; input.autocomplete = 'off'; input.spellcheck = false;
    label.append(input);
    const connect = el('button', 'Connect and check'); connect.type = 'submit';
    const check = el('button', 'Check connection'); check.type = 'button'; check.hidden = true;
    const disconnect = el('button', 'Clear hash'); disconnect.type = 'button'; disconnect.hidden = true;
    form.append(label, connect, check, disconnect);
    function replacementState() {
      const replacing = input.dataset.sessionSaved === 'true';
      connect.disabled = busy || (replacing && !input.value.trim());
    }
    input.addEventListener('input', replacementState);
    const feed = el('a', 'Your YouTube feed', 'pt-youtube-open'); feed.href = FEED;
    section.append(login, details, status, form, feed,
      el('p', 'The verified session is remembered after restart. Clear hash removes it locally without signing you out of YouTube. Your local subscriptions, playlists and history remain separate.'),
      el('p', 'Feed controls change Individuous only. Hiding a video here does not send “Not interested” to YouTube, and playback continues through the existing Invidious player.'));
    const shell = main.querySelector('.pt-page-panel'); if (shell) shell.after(section); else main.prepend(section);
    let busy = false, revision = 0;
    function paint(data) {
      const authenticated = data.connected === true && data.authenticated === true;
      const saved = data.has_session === true;
      input.dataset.sessionSaved = String(saved);
      input.placeholder = saved ? 'h a s h - l o a d e d' : 'Paste your YouTube Cookie header value';
      section.dataset.connected = String(authenticated);
      indicator(data);
      check.hidden = disconnect.hidden = !saved;
      connect.textContent = saved ? 'Replace and check session' : 'Connect and check';
      replacementState();
      status.textContent = authenticated ? 'Connected. YouTube verified this session. Your personal feed is ready to open.'
        : saved ? 'Not connected. YouTube could not verify the saved session. It may have expired, or YouTube may be unavailable. Check again, replace it or Clear hash to forget it.'
        : 'Not connected. No session saved. Your existing Individuous feeds still work.';
    }
    async function update(path, method, body) {
      if (busy) return;
      busy = true; revision++; connect.disabled = check.disabled = disconnect.disabled = true;
      if (path === 'check' || method === 'DELETE') { section.dataset.connected = 'false'; indicator(null); }
      status.textContent = method === 'DELETE' ? 'Clearing saved hash…' : 'Checking the session with YouTube…';
      try { paint(await request(path, method, body)); if (path === 'session') changed(); }
      catch (error) { if (path === 'check' || method === 'DELETE') { section.dataset.connected = 'false'; indicator(null); } status.textContent = error.message; }
      finally { busy = false; check.disabled = disconnect.disabled = false; replacementState(); }
    }
    async function statusCheck() {
      const at = ++revision;
      section.dataset.connected = 'false';
      indicator(null);
      status.textContent = 'Checking authentication with YouTube…';
      try { const data = await request('session'); if (at !== revision) return; paint(data); }
      catch (error) { if (at === revision) status.textContent = error.message; }
    }
    form.addEventListener('submit', event => { event.preventDefault(); const cookie = input.value.trim(); input.value = ''; void update('session', 'POST', { cookie }); });
    check.onclick = () => update('check', 'POST', {});
    disconnect.onclick = () => { input.value = ''; void update('session', 'DELETE'); };
    window.addEventListener('youtube-connection-changed', () => { if (!busy) void statusCheck(); });
    void statusCheck();
  }

  function card(video) {
    const node = el('div', '', 'pure-u-1 pure-u-md-1-4'), box = el('div', '', 'h-box'), thumb = el('div', '', 'thumbnail');
    const link = el('a'); link.href = '/watch?v=' + encodeURIComponent(video.videoId);
    const img = el('img'); img.className = 'thumbnail'; img.src = '/vi/' + video.videoId + '/mqdefault.jpg'; img.alt = video.title; img.loading = 'lazy'; link.append(img); thumb.append(link);
    if (video.lengthSeconds > 0) { const s = video.lengthSeconds; thumb.append(el('p', Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'), 'length')); }
    const row = el('div', '', 'video-card-row'), title = el('a', video.title); title.href = link.href; row.append(title);
    if (video.author) { const author = el('a', video.author); author.href = video.authorId ? '/channel/' + video.authorId : '/search?q=' + encodeURIComponent(video.author) + '&type=channel'; row.append(author); }
    box.append(thumb, row); node.append(box); return node;
  }
  function feed() {
    const contents = document.querySelector('#contents'); if (!contents) return;
    const header = document.querySelector('.pt-header'); if (header && contents.contains(header)) contents.before(header);
    document.dispatchEvent(new Event('feed:replacing')); contents.replaceChildren();
    document.documentElement.classList.remove('pt-feed-loading'); document.title = 'Your YouTube feed · individuous';
    const wall = el('div', '', 'pure-g pt-wall'), bar = el('div', '', 'continuous-status'), status = el('span'); status.setAttribute('role', 'status');
    const refresh = el('button', 'Refresh feed'), mix = el('button', 'Shuffle loaded videos'), more = el('button', 'Load more'), setup = el('a', 'YouTube connection'); setup.href = MENU;
    bar.append(status, refresh, mix, more, setup); contents.append(wall, bar);
    let next = null, busy = false, controller, revision = 0; const seen = new Set();
    async function load(reset) {
      if (busy) return; busy = true; const at = revision;
      controller = new AbortController(); refresh.disabled = more.disabled = true; status.textContent = 'Loading your YouTube feed…';
      try {
        const data = await request('feed' + (!reset && next ? '?cursor=' + encodeURIComponent(next) : ''), 'GET', null, controller.signal);
        if (at !== revision) return;
        if (reset) { document.dispatchEvent(new Event('feed:replacing')); wall.replaceChildren(); seen.clear(); }
        const picks = (data.videos || []).filter(v => /^[\w-]{11}$/.test(v.videoId) && !seen.has(v.videoId) && (seen.add(v.videoId), true));
        wall.append(...picks.map(card)); next = data.next; more.hidden = !next;
        document.dispatchEvent(new Event('continuous:appended'));
        status.textContent = !wall.children.length ? 'No videos returned by YouTube. Try refreshing your feed.' : next ? '' : 'End of the available recommendations.';
      } catch (error) { if (at === revision && error.name !== 'AbortError') { status.textContent = error.message; more.hidden = !next; } }
      finally { if (at === revision) { busy = false; refresh.disabled = more.disabled = false; window.ptEmptyGuide?.show('youtube', !wall.children.length, false); } }
    }
    function shuffle() {
      const cards = [...wall.children];
      for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
      wall.append(...cards); document.dispatchEvent(new Event('continuous:appended'));
    }
    refresh.onclick = () => load(true); more.onclick = () => load(false); mix.onclick = shuffle;
    document.addEventListener('keydown', event => {
      if (event.key.toLowerCase() !== 's' || event.repeat || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input,textarea,select,[contenteditable]') || document.querySelector('dialog[open]') || document.querySelector('.pt-header:hover')) return;
      event.preventDefault(); event.stopImmediatePropagation(); shuffle();
    }, true);
    window.addEventListener('youtube-connection-changed', () => {
      revision++; controller?.abort(); busy = false; next = null; seen.clear(); document.dispatchEvent(new Event('feed:replacing')); wall.replaceChildren(); void load(true);
    });
    void load(true);
  }
  function start() {
    const header = document.querySelector('.pt-header');
    if (header && !header.querySelector('.pt-youtube-feed-link')) {
      const link = el('a', '', 'pt-circle pt-youtube-feed-link'); link.href = FEED; link.title = 'Your YouTube feed'; link.setAttribute('aria-label', link.title);
      link.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 1)"/></svg>';
      if (new URLSearchParams(location.search).get('pt_page') === 'youtube') link.setAttribute('aria-current', 'page');
      const anchor = header.querySelector('.pt-menu-link') || header.querySelector('.pt-menu');
      if (anchor) anchor.before(link); else header.append(link);
    }
    const page = new URLSearchParams(location.search).get('pt_page');
    if (page !== 'menu') {
      void checkIndicator();
      window.addEventListener('youtube-connection-changed', checkIndicator);
    }
    if (page === 'youtube') feed();
    if (page === 'menu') {
      const mount = () => { const main = document.querySelector('main.pt-navigation-page'); if (!main) return false; menu(main); return true; };
      if (!mount()) { const observer = new MutationObserver(() => { if (mount()) observer.disconnect(); }); observer.observe(document.documentElement, { childList: true, subtree: true }); }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 0), { once: true }); else setTimeout(start, 0);
})();
