/* Watch-page playlist: keep the upstream navigation source and present a compact filmstrip. */
;(() => {
  'use strict';
  window.ptPlaylistBannerVersion = 1;
  if (location.pathname !== '/watch') return;
  function mount() {
    const panel = document.getElementById('playlist');
    if (!panel) return;
    let frame;
    const observer = new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(render); });
    const observe = () => observer.observe(panel, {childList:true, subtree:true});
    function render() {
      if (panel.querySelector(':scope > .pt-playlist-source')) return;
      const seen = new Set();
      const picks = [...panel.querySelectorAll('a[href]')].flatMap(link => {
        const image = link.querySelector('img');
        let url; try { url = new URL(link.href, location.origin); } catch { return []; }
        if (!image || url.origin !== location.origin || url.pathname !== '/watch' || !url.searchParams.get('v') || seen.has(url.href)) return [];
        seen.add(url.href);
        const row = link.closest('[class*="pure-u-"]') || link.parentElement;
        const heading = row.querySelector('h4,h5,.video-card-row,.playlist-video-title');
        const title = (heading?.textContent || image.alt || link.textContent || row.textContent).replace(/\s+/g, ' ').trim() || 'Playlist video';
        return [{url, image, title}];
      });
      panel.classList.toggle('pt-playlist-banner', picks.length > 0);
      if (!picks.length) return;
      observer.disconnect();
      const titleLink = panel.querySelector('h3 a,h2 a,a[href^="/playlist?"]');
      const heading = document.createElement('div'); heading.className = 'pt-playlist-banner-head';
      const name = document.createElement('a'); name.className = 'pt-playlist-banner-name'; name.textContent = titleLink?.textContent.trim() || panel.querySelector('h3,h2')?.textContent.trim() || 'Playlist';
      name.href = titleLink?.getAttribute('href') || '/playlist?list=' + encodeURIComponent(new URLSearchParams(location.search).get('list') || '');
      const rail = document.createElement('nav'); rail.className = 'pt-playlist-rail'; rail.setAttribute('aria-label', name.textContent + ' videos'); rail.tabIndex = 0;
      const current = new URLSearchParams(location.search).get('v');
      for (const pick of picks) {
        const card = document.createElement('a'); card.className = 'pt-playlist-banner-card'; card.href = pick.url.pathname + pick.url.search; card.title = pick.title; card.setAttribute('aria-label', pick.title);
        const image = pick.image.cloneNode(); image.removeAttribute('id'); image.removeAttribute('style'); image.removeAttribute('width'); image.removeAttribute('height'); image.alt = ''; image.loading = 'lazy';
        const caption = document.createElement('span'); caption.className = 'pt-playlist-banner-caption'; caption.textContent = pick.title;
        if (pick.url.searchParams.get('v') === current) card.setAttribute('aria-current', 'true');
        card.append(image, caption); rail.append(card);
      }
      const controls = document.createElement('div'); controls.className = 'pt-playlist-banner-controls';
      for (const [text, label, direction] of [['‹','Previous playlist videos',-1],['›','Next playlist videos',1]]) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = text; button.setAttribute('aria-label', label);
        button.onclick = () => rail.scrollBy({left:direction * rail.clientWidth * .8, behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
        controls.append(button);
      }
      heading.append(name, controls);
      const source = document.createElement('div'); source.className = 'pt-playlist-source'; source.hidden = true; source.append(...panel.childNodes);
      panel.append(source, heading, rail);
      requestAnimationFrame(() => { const selected = rail.querySelector('[aria-current]'); if (selected) rail.scrollLeft = Math.max(0, selected.offsetLeft - rail.offsetLeft - (rail.clientWidth - selected.clientWidth) / 2); });
      observe();
    }
    render(); observe();
    window.addEventListener('pagehide', () => {observer.disconnect();cancelAnimationFrame(frame);}, {once:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true}); else mount();
})();
