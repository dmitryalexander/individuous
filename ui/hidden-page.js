/* Hidden videos page (October 15, 2026): /search?pt_page=hidden, opened by the round Hidden videos button on the Menu.
   It replaces the old pop-up list with a wall of the videos you hid, like the Hidden pins page in Pinless.
     X twice over a video            restore it (the first press turns it red, Esc or moving away cancels)
     Ctrl+Shift+X twice              restore every hidden video (Esc cancels)
   The explanation lives in the Hidden videos box on the Menu (hotkeys-guide.js), not on this page.
   Hidden videos are the list in localStorage "pt-hidden-feed-v1" that pinless-look.js reads (filterHiddenFeed()).
   The tiles are the same markup as every other wall, so pinless-look.js turns them into the usual tiles
   (strips, hover preview, A to save); it knows not to hide them again (isHiddenPage()). */
;(() => {
  'use strict';
  if (location.pathname !== '/search' || new URLSearchParams(location.search).get('pt_page') !== 'hidden') return;
  const KEY = 'pt-hidden-feed-v1', STEP = 40;
  const $ = (selector, root) => (root || document).querySelector(selector);
  function el(tag, className, text) { const n = document.createElement(tag); if (className) n.className = className; if (text) n.textContent = text; return n; }
  function read() {
    try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v.filter(x => x && typeof x.id === 'string' && /^[\w-]+$/.test(x.id)) : []; }
    catch (_) { return []; }
  }
  let note, noteTimer = 0;
  function notify(text, ms) {
    if (!note) { note = el('div', 'pt-hidden-notice'); note.setAttribute('role', 'status'); document.body.append(note); }
    note.textContent = text; note.hidden = false;
    clearTimeout(noteTimer); if (ms) noteTimer = setTimeout(() => { note.hidden = true; }, ms);
  }
  function write(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items)); return true; }
    catch (_) { notify('Could not save. Allow browser storage and try again.', 5000); return false; }
  }

  function start() {
    const contents = $('#contents'); if (!contents) return;
    const header = $('.pt-header');
    if (header && contents.contains(header)) contents.before(header);
    document.dispatchEvent(new Event('feed:replacing'));
    contents.replaceChildren();
    const wall = el('div', 'pure-g pt-wall'), status = el('p', 'pt-hidden-status'); status.setAttribute('role', 'status');
    wall.setAttribute('aria-label', 'Hidden videos');
    contents.append(wall, status);
    let items = read(), shown = 0, armedCard = null, armedAll = false, armTimer = 0;

    function card(item) {
      const node = el('div', 'pure-u-1 pure-u-md-1-4'), box = el('div', 'h-box'), thumb = el('div', 'thumbnail');
      const link = el('a'); link.href = '/watch?v=' + encodeURIComponent(item.id);
      const img = el('img', 'thumbnail'); img.src = '/vi/' + encodeURIComponent(item.id) + '/mqdefault.jpg'; img.alt = item.title || item.id; img.loading = 'lazy';
      link.append(img); thumb.append(link);
      const row = el('div', 'video-card-row'), name = el('a', '', item.title || item.id); name.href = link.href;
      row.append(name); box.append(thumb, row); node.append(box);
      return node;
    }
    function refreshStatus() { status.textContent = items.length ? '' : 'No hidden videos.'; window.ptEmptyGuide?.show('hidden', !items.length); }
    function more() {
      const next = items.slice(shown, shown + STEP); if (!next.length) return;
      shown += next.length; wall.append(...next.map(card));
      document.dispatchEvent(new Event('continuous:appended'));
    }
    function relayout() { document.dispatchEvent(new Event('continuous:appended')); }
    function rebuild() { items = read(); shown = 0; wall.replaceChildren(); more(); refreshStatus(); relayout(); }
    new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) more(); }, {rootMargin: '900px'}).observe(status);

    function disarm() {
      clearTimeout(armTimer); armTimer = 0; armedAll = false;
      document.body.classList.remove('pt-hidden-clear-armed');
      if (armedCard) { armedCard.classList.remove('pt-hide-armed'); $('.pt-hide-hint', armedCard)?.remove(); }
      armedCard = null;
      if (note) note.hidden = true;
    }
    function restore(ids) {
      const set = new Set(ids);
      if (!write(read().filter(v => !set.has(v.id)))) return;
      items = items.filter(v => !set.has(v.id));
      let removed = 0;
      [...wall.children].forEach(card => { const id = $('.pt-thumb', card)?.dataset.ptId || ''; if (set.has(id)) { card.remove(); removed++; } });
      shown = Math.max(0, shown - removed);
      refreshStatus(); relayout();
    }
    function restoreEverything() {
      if (!write([])) return;
      items = []; shown = 0; wall.replaceChildren(); refreshStatus(); relayout();
    }

    document.addEventListener('pointerover', event => { if (armedCard && !armedCard.contains(event.target)) disarm(); });
    addEventListener('blur', disarm);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') { disarm(); return; }
      if (event.key.toLowerCase() !== 'x' || event.repeat || event.altKey || event.metaKey || event.isComposing) return;
      if (event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])') || document.querySelector('dialog[open]')) return;
      if (event.ctrlKey && event.shiftKey) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (!items.length) return;
        if (armedAll) { disarm(); restoreEverything(); return; }
        disarm(); armedAll = true; document.body.classList.add('pt-hidden-clear-armed');
        notify('Press Ctrl+Shift+X again to restore all ' + items.length + ' · Esc cancels');
        armTimer = setTimeout(disarm, 4000);
        return;
      }
      if (event.ctrlKey || event.shiftKey || $('.pt-header:hover')) return;
      const target = $('.pt-video:hover'); if (!target) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (armedCard === target) { const id = $('.pt-thumb', target)?.dataset.ptId; disarm(); if (id) restore([id]); return; }
      disarm(); armedCard = target; target.classList.add('pt-hide-armed');
      const hint = el('span', 'pt-hide-hint', 'Press X again to restore · Esc to cancel'); hint.setAttribute('role', 'status');
      ($('.pt-thumb', target) || target).append(hint);
      armTimer = setTimeout(disarm, 4000);
    }, true);
    addEventListener('storage', event => { if (event.key === KEY || event.key === null) { disarm(); rebuild(); } });

    more(); refreshStatus();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true}); else start();
})();
