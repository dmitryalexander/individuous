/* Random subscription discovery. Only the signed-in account's channels are used.
   Archive continuations are explored in bounded batches, never all at once. */
;(() => {
  'use strict';
  if (['menu','filters'].includes(new URLSearchParams(location.search).get('pt_page'))) return;
  const ORDER_KEY = 'pt-channel-feed-order-v1';
  const modes = ['newest', 'random', 'oldest'];
  function orders() {
    try { const value = JSON.parse(localStorage.getItem(ORDER_KEY)); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch (_) { return {}; }
  }
  const orderFor = id => modes.includes(orders()[id]) ? orders()[id] : 'random';
  function channelControl() {
    const id = location.pathname.match(/^\/channel\/(UC[\w-]{22})(?:\/|$)/)?.[1];
    if (!id || document.querySelector('.pt-feed-order')) return;
    const group = document.createElement('div'); group.className = 'pt-feed-order';
    group.setAttribute('role', 'group'); group.setAttribute('aria-label', 'Feed order');
    const legend = document.createElement('strong'); legend.textContent = 'Feed order'; group.append(legend);
    const labels = ['Newest first', 'Random', 'Oldest first'];
    const note = document.createElement('span'); note.className = 'pt-feed-order-note'; note.textContent = 'For this channel in your feed Â· saved in this browser';
    modes.forEach((mode, i) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = labels[i];
      button.setAttribute('aria-pressed', String(orderFor(id) === mode));
      button.onclick = () => {
        try { localStorage.setItem(ORDER_KEY, JSON.stringify({...orders(), [id]: mode})); }
        catch (_) { note.textContent = 'Could not save. Allow browser storage and try again.'; return; }
        [...group.querySelectorAll('button')].forEach((b, j) => b.setAttribute('aria-pressed', String(modes[j] === mode)));
      };
      group.append(button);
    });
    group.append(note);
    const anchor = document.querySelector('.channel-profile')?.closest('.pure-g') || document.querySelector('#subscribe')?.closest('.pure-g') || document.querySelector('.pt-header');
    if (anchor) anchor.after(group); else document.querySelector('#contents')?.prepend(group);
    compactChannel(id, group);
  }
  // Feed order badge (2026-10-14): a round icon on the corner of a followed creator's picture. Click to cycle
  // Random -> Newest first -> Oldest first. It replaces the "Feed order" buttons the compact channel bar dropped.
  const ORDER_INFO = {
    random: { label: 'Random', help: 'mixed in with your other creators',
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>' },
    newest: { label: 'Newest first', help: 'latest uploads come first',
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 16 4 4 4-4M7 20V4M11 4h10M11 8h7M11 12h4"/></svg>' },
    oldest: { label: 'Oldest first', help: 'from the first upload, good for tutorials',
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 8 4-4 4 4M7 4v16M11 12h4M11 16h7M11 20h10"/></svg>' }
  };
  // Feed order group (2026-10-15): the third section of the creator's top bar, after the Videos pills and the sort pills.
  // Three round icons (Newest first, Random, Oldest first); the current one is amber like the selected pills. Point at one
  // for a small card with its name and what it is good for. Shows on every creator page; the order only matters once you follow.
  const ORDER_HELP = {
    random: 'Mixed in with your other creators Â· good for retrospectives',
    newest: 'Latest uploads come first Â· good for news',
    oldest: 'From the first upload Â· good for tutorials'
  };
  function feedOrderGroup(id, holder, bar) {
    const group = document.createElement('nav'); group.className = 'pt-channel-order'; group.setAttribute('aria-label', 'Feed order for this creator');
    const tip = document.createElement('div'); tip.className = 'pt-playlist-picker pt-order-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
    const tipName = document.createElement('strong'), tipHelp = document.createElement('span'), tipNote = document.createElement('small');
    tip.append(tipName, tipHelp, tipNote); document.body.append(tip);
    const options = modes.map(mode => {
      const info = ORDER_INFO[mode], button = document.createElement('button'); button.type = 'button'; button.className = 'pt-order-opt';
      button.dataset.mode = mode; button.innerHTML = info.icon;
      button.setAttribute('aria-label', 'Feed order: ' + info.label + '. ' + ORDER_HELP[mode]);
      button.addEventListener('click', () => {
        try { localStorage.setItem(ORDER_KEY, JSON.stringify({...orders(), [id]: mode})); }
        catch (_) { tipNote.textContent = 'Could not save. Allow browser storage and try again.'; return; }
        show(); showTip(button);
      });
      button.addEventListener('pointerenter', () => showTip(button));
      button.addEventListener('focus', () => showTip(button));
      button.addEventListener('pointerleave', hideTip);
      button.addEventListener('blur', hideTip);
      return button;
    });
    function show() { const current = orderFor(id); options.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === current))); }
    function showTip(button) {
      const mode = button.dataset.mode;
      tipName.textContent = ORDER_INFO[mode].label; tipHelp.textContent = ORDER_HELP[mode];
      tipNote.textContent = (orderFor(id) === mode ? 'Current order for this creator. ' : 'Click to use it for this creator. ')
        + (holder.dataset.subscribed === 'true' ? '' : 'Follow the creator for it to apply to your Subscriptions Feed.');
      tip.hidden = false;
      const box = button.getBoundingClientRect();
      tip.style.top = Math.round(box.bottom + 8) + 'px';
      tip.style.left = Math.round(Math.max(8, Math.min(box.left + box.width / 2 - tip.offsetWidth / 2, innerWidth - tip.offsetWidth - 8))) + 'px';
    }
    function hideTip() { tip.hidden = true; }
    addEventListener('scroll', hideTip, {passive: true}); addEventListener('resize', hideTip);
    addEventListener('storage', event => { if (event.key === ORDER_KEY || event.key === null) show(); });
    group.append(...options); show();
    bar.append(group);
  }
  function compactChannel(id, order) {
    const profile = document.querySelector('.channel-profile');
    const titleRow = profile?.closest('.pure-g');
    if (!titleRow) return;
    document.body.classList.add('pt-channel-page');
    const name = profile.querySelector('.channel-name')?.textContent.trim() || document.title.replace(/ - Invidious$/, '');
    const base = '/channel/' + id;
    const bar = document.createElement('div'); bar.className = 'pt-channel-bar';
    const details = document.createElement('div'); details.className = 'pt-channel-about';
    const avatar = document.createElement('button'); avatar.type = 'button'; avatar.className = 'pt-channel-avatar-toggle'; avatar.title = name; avatar.setAttribute('aria-label', name);
    const img = profile.querySelector('img'); if (img) avatar.append(img);
    else avatar.textContent = name.slice(0, 1);
    const panel = document.createElement('div'); panel.className = 'pt-channel-panel';
    const description = document.querySelector('#descriptionWrapper');
    if (description) { const wrapper = description.parentElement; panel.append(description); if (!wrapper.children.length) wrapper.remove(); }
    // Shorts and other channel tabs append their path to the YouTube link.
    const youtube = document.querySelector('a[href^="https://www.youtube.com/channel/' + id + '"]');
    const oldNav = youtube?.closest('.pure-g.h-box') || youtube?.closest('.pure-g');
    details.append(avatar);
    const hero = document.createElement('div'); hero.className = 'pt-channel-hero';
    const bannerImage = [...document.querySelectorAll('#contents > .h-box > img')].find(image => !image.closest('.pt-wall'));
    const banner = document.createElement('a'); banner.className = 'pt-channel-banner'; banner.href = 'https://www.youtube.com/channel/' + id;
    banner.title = 'Open ' + name + ' on YouTube'; banner.setAttribute('aria-label', banner.title);
    const fallbackBanner=()=>{const title=document.createElement('span');title.textContent=name;banner.replaceChildren(title);banner.classList.add('creator-name-banner');};
    if (bannerImage) { const wrapper = bannerImage.parentElement; banner.append(bannerImage); wrapper.remove(); bannerImage.addEventListener('error',fallbackBanner,{once:true});if(bannerImage.complete&&!bannerImage.naturalWidth)fallbackBanner(); }
    else fallbackBanner();
    hero.append(details, banner);
    const tabs = document.createElement('nav'); tabs.className = 'pt-channel-tabs'; tabs.setAttribute('aria-label', 'Channel content');
    for (const [label, suffix] of [['Videos',''],['Shorts','/shorts'],['Playlists','/playlists']]) {
      const link = document.createElement('a'); link.href = base + suffix; link.textContent = label;
      const here = location.pathname.replace(/\/$/, '').replace(/\/videos$/, '');
      if (here === base + suffix) link.setAttribute('aria-current', 'page');
      tabs.append(link);
    }
    bar.append(tabs);
    const sorts = document.createElement('nav'); sorts.className = 'pt-channel-sorts'; sorts.setAttribute('aria-label', 'Sort channel content');
    oldNav?.querySelectorAll('a[href*="sort_by="], b').forEach(node => {
      if (!/^(newest|oldest|popular|last|alphabetically)$/i.test(node.textContent.trim())) return;
      const item = node.cloneNode(true); if (item.tagName === 'B') item.setAttribute('aria-current', 'page'); sorts.append(item);
    });
    // The current sort always shows as selected, even when the page leaves it out.
    if (sorts.children.length && !sorts.querySelector('[aria-current]')) {
      const wanted = (new URLSearchParams(location.search).get('sort_by') || 'newest').toLowerCase();
      [...sorts.children].find(node => node.textContent.trim().toLowerCase() === wanted)?.setAttribute('aria-current', 'page');
    }
    bar.append(sorts);
    order.remove();
    const subscribe = titleRow.querySelector('#subscribe');
    if (subscribe) {
      const holder = document.createElement('div'); holder.className = 'pt-channel-follow';
      holder.append(subscribe.closest('form') || subscribe); hero.append(holder);
      // Keep the native handler, CSRF form, and failure rollback intact.
      const syncIcon = () => {
        const subscribed = subscribe.onclick?.name === 'unsubscribe' || /unsubscribe/i.test(subscribe.textContent);
        details.dataset.subscribed = String(subscribed);
        avatar.title = (subscribed ? 'Unsubscribe from ' : 'Subscribe to ') + name;
        avatar.setAttribute('aria-label', avatar.title);
        avatar.setAttribute('aria-pressed', String(subscribed));
        subscribe.setAttribute('aria-label', subscribed ? 'Unsubscribe' : 'Subscribe');
        subscribe.title = subscribed ? 'Unsubscribe' : 'Subscribe';
        subscribe.setAttribute('aria-pressed', String(subscribed));
        if (!subscribe.querySelector('svg')) {
          subscribe.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="19" cy="15" r="8"/><path d="M5 41v-4a14 14 0 0 1 28 0v4M34 21h12"/><path class="pt-follow-plus" d="M40 15v12"/></svg>');
        }
      };
      new MutationObserver(syncIcon).observe(subscribe, {childList:true,subtree:true,characterData:true}); syncIcon();
      const flashTimers = new WeakMap();
      function toggleSubscription(target) {
        const wasSubscribed = details.dataset.subscribed === 'true';
        subscribe.click();
        syncIcon();
        if ((details.dataset.subscribed === 'true') === wasSubscribed) return;
        const flash = wasSubscribed ? 'pt-channel-unsubscribe-flash' : 'pt-channel-subscribe-flash';
        const surfaces = [avatar, banner];
        surfaces.forEach(surface => {
          clearTimeout(flashTimers.get(surface));
          surface.classList.remove('pt-channel-unsubscribe-flash', 'pt-channel-subscribe-flash');
        });
        void hero.offsetWidth;
        surfaces.forEach(surface => {
          surface.classList.add(flash);
          flashTimers.set(surface, setTimeout(() => surface.classList.remove(flash), 260));
        });
      }
      avatar.addEventListener('click', () => toggleSubscription(avatar));
      document.addEventListener('keydown', event => {
        const key = event.key.toLowerCase();
        if (!['a', 'x'].includes(key) || event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
        if (document.querySelector('dialog[open]') || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
        const target = [avatar, banner].find(area => area.matches(':hover') || area === document.activeElement);
        if (!target) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const subscribed = details.dataset.subscribed === 'true';
        if ((key === 'a' && subscribed) || (key === 'x' && !subscribed)) return;
        toggleSubscription(target);
      }, true);
    }
    titleRow.before(hero, bar); titleRow.remove(); oldNav?.remove();
    const header = document.querySelector('.pt-header');
    const navigation = header?.querySelector('.pt-nav');
    if (navigation) {
      header.classList.add('pt-interest-header');
      navigation.before(bar);
    }
    feedOrderGroup(id, details, bar);
    const input = document.querySelector('.pt-search input[name="q"]');
    if (input) {
      input.value = ''; input.dataset.channelName = name; input.placeholder = name; input.setAttribute('aria-label', 'Search ' + name);
      const scope = document.createElement('input'); scope.type = 'hidden'; scope.name = 'channel'; scope.value = id; input.form.append(scope);
      input.form.addEventListener('formdata', event => {
        const query = event.formData.get('q') || '';
        event.formData.set('q', 'channel:' + id + (query.trim() ? ' ' + query.trim() : ''));
        event.formData.delete('channel');
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', channelControl, {once:true}); else channelControl();
  if (location.pathname !== '/feed/subscriptions') return;
  const shuffle = items => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  function start() {
    const contents = document.querySelector('#contents');
    if (!contents || document.querySelector('form[action="/login"]')) return;
    let followingGroup;
    try { followingGroup = window.ptFollowingGroups?.active() || {id:'all',name:'All following'}; }
    catch(error) { contents.querySelectorAll('.pt-wall').forEach(wall => wall.replaceChildren()); const note = document.createElement('p'); note.setAttribute('role','status'); note.textContent = error.message; contents.append(note); document.documentElement.classList.remove('pt-feed-loading'); return; }
    let wall = [...contents.querySelectorAll('.pt-wall')].pop();
    if (!wall) {
      wall = document.createElement('div');
      wall.className = 'pure-g pt-wall';
      contents.append(wall);
    }
    if (followingGroup.id !== 'all') { document.dispatchEvent(new Event('feed:replacing')); contents.querySelectorAll('.pt-wall').forEach(other => { if (other !== wall) other.remove(); }); wall.replaceChildren(); }
    const bar = document.createElement('div');
    bar.className = 'continuous-status';
    const status = document.createElement('span');
    status.setAttribute('role', 'status');
    const more = document.createElement('button');
    more.textContent = 'Load more';
    const mix = document.createElement('button');
    mix.textContent = 'Shuffle videos';
    mix.title = 'Hover the videos and press S';
    bar.append(status, mix, more);
    wall.after(bar);
    const warning = document.createElement('section');
    warning.className = 'pt-loading-warning';
    warning.setAttribute('aria-label', 'Video viewing advisory');
    warning.innerHTML = `<div class="pt-warning-art"><img src="/warning.png?v=2026-10-07w" alt="Skull and crossbones cassette warning sticker"></div><h1>WARNING</h1><div class="pt-warning-rating"><div class="pt-warning-grade"><strong>AA</strong><span>seriously addicting</span></div><strong class="pt-warning-heading">COMPULSIVE VIEWING CAN DISRUPT DAILY LIFE</strong><div class="pt-warning-body"><p>Repeated, prolonged viewing can crowd out sleep, focused work, physical activity and time with other people. Personalized recommendations, autoplay and endless short-form feeds make it easy to continue watching beyond the time you intended. When viewing becomes difficult to control, it can interfere with responsibilities, relationships and emotional well-being.</p><p>Using videos to repeatedly avoid stress or difficult feelings can leave the underlying problems unresolved. Watch for lost sleep, neglected commitments, reduced concentration and unsuccessful attempts to cut back. Pay attention to the effect on your everyday life and the time you are choosing to spend here.</p></div><p class="pt-warning-fine">SET A TIME LIMIT BEFORE YOU WATCH. PAUSE AUTOPLAY. TAKE REGULAR BREAKS. IF VIEWING IS DIFFICULT TO CONTROL OR CAUSES DISTRESS, CONSIDER SEEKING PROFESSIONAL SUPPORT.</p></div>`;
    wall.before(warning);
    const pool = new Map(), shown = new Set();
    let sources = [], busy = false, initialized = false, replaced = false;
    let pointer = null;
    document.addEventListener('pointermove', e => { pointer = [e.clientX, e.clientY]; }, {passive: true});
    document.addEventListener('pointerout', e => { if (!e.relatedTarget) pointer = null; });
    window.addEventListener('blur', () => { pointer = null; });
    // Capture so the existing search-term shortcut cannot consume a wall shuffle.
    document.addEventListener('keydown', e => {
      if (e.key.toLowerCase() !== 's' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.isComposing || e.defaultPrevented) return;
      if (document.querySelector('dialog[open]') || e.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')) return;
      const target = pointer && document.elementFromPoint(...pointer);
      if (!target || target.closest('.pt-header') || !contents.contains(target)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      refresh(true);
    }, true);
    async function request(url, json = true) {
      const response = await fetch(url, {credentials: 'same-origin', signal: AbortSignal.timeout(15000)});
      if (!response.ok) throw Error('Unavailable');
      return json ? response.json() : response.text();
    }
    async function discover() {
      const doc = new DOMParser().parseFromString(await request('/subscription_manager', false), 'text/html');
      const followedIds = [...new Set([...doc.querySelectorAll('a[href^="/channel/"]')].map(a => a.getAttribute('href').split('/')[2]).filter(id => /^UC[\w-]{22}$/.test(id)))];
      const ids = window.ptFollowingGroups ? window.ptFollowingGroups.filter(followedIds) : followedIds;
      if (!ids.length) { window.ptEmptyGuide?.show('subscriptions', true); throw Error(followingGroup.id === 'all' ? 'Follow creators to build your feed.' : 'No followed creators in this group. Point at the group name and press I to choose creators.'); }
      // Each channel gets one turn before any channel gets another. Mix oldest,
      // newest and popular entry points, then walk their archive continuations.
      sources = shuffle(ids).map(id => ({id, sorts: orderFor(id) === 'random' ? shuffle(['oldest', 'newest', 'popular']) : [orderFor(id)], continuation: null, failures: 0}));
      initialized = true;
    }
    async function collect() {
      let failures = 0;
      const batch = sources.splice(0, 12);
      let index = 0;
      await Promise.all(Array.from({length: 3}, async () => {
        while (index < batch.length) {
          const source = batch[index++];
          // Ordered channels must keep their first unhidden uploads. Explore the
          // next page only when the existing queue is nearly consumed/hidden.
          if (orderFor(source.id) !== 'random' && source.continuation) {
            let hidden = [];
            try { hidden = JSON.parse(localStorage.getItem('pt-hidden-feed-v1') || '[]').map(v => v.id); } catch (_) {}
            const displayed = new Set([...wall.querySelectorAll('[data-pt-id]')].map(n => n.dataset.ptId));
            const remaining = [...(pool.get(source.id)?.keys() || [])].filter(id => !hidden.includes(id) && !displayed.has(id));
            if (remaining.length >= 48) { sources.push(source); continue; }
          }
          const url = new URL('/api/v1/channels/' + source.id + '/videos', location.origin);
          url.searchParams.set('sort_by', source.sorts[0]);
          if (source.continuation) url.searchParams.set('continuation', source.continuation);
          try {
            const data = await request(url);
            if (!Array.isArray(data.videos)) throw Error('Invalid channel response');
            const videos = pool.get(source.id) || new Map();
            for (const video of data.videos) {
              if (/^[\w-]{11}$/.test(video.videoId) && !video.isUpcoming) videos.set(video.videoId, {...video, authorId: source.id});
            }
            if (orderFor(source.id) === 'random') while (videos.size > 180) videos.delete(videos.keys().next().value);
            pool.set(source.id, videos);
            source.failures = 0;
            // Alternate entry points before continuing further into each one.
            const continuation = data.continuation;
            if (source.sorts.length > 1) {
              if (continuation) sources.push({...source, sorts: [source.sorts[0]], continuation});
              source.sorts = source.sorts.slice(1); source.continuation = null;
              sources.push(source);
            } else if (continuation && continuation !== source.continuation) {
              source.continuation = continuation; sources.push(source);
            }
          } catch (_) {
            failures++;
            source.failures++;
            sources.push(source); // Retry on a later user action; never discard a channel.
          }
        }
      }));
      return failures;
    }
    function card(video) {
      const node = document.createElement('div'); node.className = 'pure-u-1 pure-u-md-1-4';
      const box = document.createElement('div'); box.className = 'h-box';
      const thumb = document.createElement('div'); thumb.className = 'thumbnail';
      const link = document.createElement('a'); link.href = '/watch?v=' + video.videoId;
      const img = document.createElement('img'); img.className = 'thumbnail'; img.src = '/vi/' + video.videoId + '/mqdefault.jpg'; img.alt = video.title; img.loading = 'lazy';
      link.append(img); thumb.append(link);
      const length = document.createElement('p'); length.className = 'length';
      const seconds = Number(video.lengthSeconds) || 0;
      length.textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0'); thumb.append(length);
      const row = document.createElement('div'); row.className = 'video-card-row';
      const title = document.createElement('a'); title.href = link.href; title.textContent = video.title;
      const author = document.createElement('a'); author.href = '/channel/' + video.authorId; author.textContent = video.author;
      row.append(title, author); box.append(thumb, row); node.append(box); return node;
    }
    function draw(replace) {
      let hidden = [];
      try { hidden = JSON.parse(localStorage.getItem('pt-hidden-feed-v1') || '[]').map(v => v.id); } catch (_) {}
      const excluded = new Set(hidden);
      const current = new Set([...wall.querySelectorAll('[data-pt-id]')].map(t => t.dataset.ptId));
      const channels = shuffle([...pool.entries()]).map(([id, videos]) => {
        const ordered = orderFor(id) !== 'random';
        // API order is authoritative; timestamps can be approximate or tied.
        const available = [...videos.values()].filter(v => !excluded.has(v.videoId) && ((replace && ordered) || !current.has(v.videoId)));
        if (ordered) return available;
        const eligible = shuffle(available);
        return [...eligible.filter(v => !shown.has(v.videoId)), ...eligible.filter(v => shown.has(v.videoId))];
      });
      const picks = [], ids = new Set();
      while (picks.length < 48 && channels.some(c => c.length)) {
        for (const channel of channels) {
          const video = channel.shift();
          if (video && !ids.has(video.videoId)) { picks.push(video); ids.add(video.videoId); }
          if (picks.length === 48) break;
        }
      }
      if (!picks.length) {
        if (replace && replaced && wall.children.length > 1 && [...pool.keys()].every(id => orderFor(id) === 'random')) {
          document.dispatchEvent(new Event('feed:replacing'));
          wall.append(...shuffle(wall.children));
          document.dispatchEvent(new CustomEvent('continuous:appended'));
        }
        return false;
      }
      if (replace || !replaced) {
        document.dispatchEvent(new Event('feed:replacing'));
        contents.querySelectorAll('.pt-wall').forEach(other => { if (other !== wall) other.remove(); });
        contents.querySelectorAll('.page-next-container,.page-prev-container').forEach(n => { n.hidden = true; });
        wall.replaceChildren(); replaced = true;
      }
      // Channels are shuffled, but each channel's own queue stays in order.
      wall.append(...picks.map(card));
      document.documentElement.classList.remove('pt-feed-loading');
      picks.forEach(v => shown.add(v.videoId));
      while (shown.size > 12000) shown.delete(shown.values().next().value);
      document.dispatchEvent(new CustomEvent('continuous:appended'));
      if (replace) window.scrollTo({top: Math.max(0, wall.offsetTop - 100), behavior: 'instant'});
      return true;
    }
    async function refresh(replace) {
      if (busy) return;
      busy = true; more.disabled = mix.disabled = true; wall.setAttribute('aria-busy', 'true');
      warning.hidden = replaced;
      bar.classList.toggle('pt-initial-loading', !replaced);
      status.textContent = 'Finding videos across your subscriptionsâ€¦';
      try {
        const immediate = replace && replaced && draw(true);
        if (!initialized) await discover();
        const failures = await collect();
        const added = immediate || draw(replace);
        window.ptEmptyGuide?.show('subscriptions', !wall.children.length, false);
        status.textContent = failures ? 'Some channels couldnâ€™t load. Try again for more videos.' : added ? '' : 'No different videos available yet. Try again to explore more.';
      } catch (error) { status.textContent = error.message === 'Unavailable' ? 'Videos couldnâ€™t load. Try again.' : error.message; }
      finally {
        warning.hidden = true;
        bar.classList.remove('pt-initial-loading');
        busy = false; more.disabled = mix.disabled = false; wall.removeAttribute('aria-busy');
        if (resetPending) { resetPending = false; pool.clear(); sources = []; initialized = false; refresh(true); }
      }
    }
    more.onclick = () => refresh(false);
    mix.onclick = () => refresh(true);
    let resetPending = false;
    addEventListener('storage', event => {
      if (event.key === ORDER_KEY || event.key === null) {
        if (busy) { resetPending = true; return; }
        pool.clear(); sources = []; initialized = false; refresh(true);
      }
    });
    new IntersectionObserver(entries => {
      if (!window.ptSandbox?.restore && replaced && !busy && sources.length && entries.some(e => e.isIntersecting)) refresh(false);
    }, {rootMargin: '400px'}).observe(bar);
    const memory=window.ptSandbox;
    const membership = JSON.stringify([...(followingGroup.channels || [])].sort());
    memory?.register(()=>({kind:'subscriptions',followingGroupId:followingGroup.id,followingMembers:membership,sources,pool:[...pool].map(([id,v])=>[id,[...v]]),shown:[...shown]}));
    if(memory?.restore?.state?.kind==='subscriptions' && (memory.restore.state.followingGroupId || 'all') === followingGroup.id && (memory.restore.state.followingMembers || '[]') === membership){
      const snapshot=memory.restore;
      sources=snapshot.state.sources; snapshot.state.pool.forEach(([id,v])=>pool.set(id,new Map(v)));snapshot.state.shown.forEach(id=>shown.add(id));
      initialized=true;replaced=true;
      contents.querySelectorAll('.pt-wall').forEach(other=>{if(other!==wall)other.remove();});
      wall.replaceChildren(...snapshot.items.map(card));warning.hidden=true;
      document.documentElement.classList.remove('pt-feed-loading');
      document.dispatchEvent(new Event('continuous:appended'));
      window.ptEmptyGuide?.show('subscriptions', !wall.children.length, !sources.length);
    }else refresh(true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
})();
