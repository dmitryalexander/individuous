;
/* Search tags (October 14, 2026), like ScratchPad's: #words typed into the search box choose what a
   search shows. Tags ignore capitalization and combine: tags from the same group are alternatives
   ("#channels #playlists" shows either), groups narrow each other ("#shorts #week" shows Shorts from
   this week), and quality tags must all match ("#4k #hdr"). Unknown #words stay search text; a quoted
   tag ("#live") is searched literally. Menu lists every tag. Loaded before search-improvements.js. */
(function () {
  'use strict';
  var GROUPS = [
    { id: 'type', name: 'What to find', help: 'Pick one or more. With several, you get any of them.', tags: [
      { name: 'videos', aliases: ['video', 'vid', 'vids'], help: 'Videos: the usual results.', param: 'video' },
      { name: 'shorts', aliases: ['ytshorts'], help: 'Shorts: videos up to 3 minutes, found with the Short duration filter.', param: 'video' },
      { name: 'channels', aliases: ['channel', 'creators', 'creator'], help: 'Channels.', param: 'channel' },
      { name: 'playlists', aliases: ['playlist'], help: 'Playlists.', param: 'playlist' },
      { name: 'movies', aliases: ['movie', 'films', 'film'], help: 'Movies.', param: 'movie' },
      { name: 'shows', aliases: ['show', 'series'], help: 'Shows.', param: 'show' }] },
    { id: 'length', name: 'Length', help: 'Pick one or more.', tags: [
      { name: 'short', aliases: ['under4'], help: 'Under 4 minutes.', param: 'short', min: 0, max: 240 },
      { name: 'medium', aliases: ['4to20'], help: '4 to 20 minutes.', param: 'medium', min: 240, max: 1200 },
      { name: 'long', aliases: ['over20'], help: 'Over 20 minutes.', param: 'long', min: 1200, max: Infinity }] },
    { id: 'date', name: 'Uploaded', help: 'With several, the longest period counts.', tags: [
      { name: 'hour', aliases: ['lasthour'], help: 'In the last hour.', param: 'hour' },
      { name: 'today', aliases: [], help: 'Today.', param: 'today' },
      { name: 'week', aliases: ['thisweek'], help: 'This week.', param: 'week' },
      { name: 'month', aliases: ['thismonth'], help: 'This month.', param: 'month' },
      { name: 'year', aliases: ['thisyear'], help: 'This year.', param: 'year' }] },
    { id: 'sort', name: 'Order', help: 'Pick one; the last one typed counts.', tags: [
      { name: 'popular', aliases: ['views', 'mostviewed'], help: 'Most viewed first.', param: 'views' },
      { name: 'relevant', aliases: ['relevance', 'bestmatch'], help: 'Best match first (the usual order).', param: 'relevance' }] },
    { id: 'features', name: 'Quality and features', help: 'Each one narrows the results: #4k #hdr finds videos that are both.', tags: [
      { name: 'hd', aliases: [], help: 'HD.', param: 'hd' },
      { name: '4k', aliases: ['uhd'], help: '4K.', param: '4k' },
      { name: 'hdr', aliases: [], help: 'HDR.', param: 'hdr' },
      { name: 'live', aliases: ['livestream', 'streams'], help: 'Live streams.', param: 'live' },
      { name: 'subtitles', aliases: ['subs', 'captions', 'cc'], help: 'Has subtitles or captions.', param: 'subtitles' },
      { name: 'creativecommons', aliases: ['commons', 'reusable'], help: 'Creative Commons licence.', param: 'creative_commons' },
      { name: '360', aliases: ['360video'], help: '360° videos.', param: '360' },
      { name: 'vr180', aliases: ['vr'], help: 'VR180 videos.', param: 'vr180' },
      { name: '3d', aliases: [], help: '3D videos.', param: '3d' },
      { name: 'location', aliases: ['places'], help: 'Has a location.', param: 'location' },
      { name: 'purchased', aliases: ['bought'], help: 'Bought on YouTube.', param: 'purchased' }] },
    { id: 'shape', name: 'Shape', help: 'Pick one or more. Tiles are sorted as their pictures load.', tags: [
      { name: 'tall', aliases: ['vertical', 'portrait'], help: 'Taller than wide.' },
      { name: 'square', aliases: ['squares'], help: 'About as wide as tall.' },
      { name: 'wide', aliases: ['landscape', 'horizontal'], help: 'Wider than tall.' }] }
  ];
  var DATE_ORDER = ['hour', 'today', 'week', 'month', 'year'];
  var lookup = {};
  GROUPS.forEach(function (group) {
    group.tags.forEach(function (tag) {
      tag.group = group.id;
      [tag.name].concat(tag.aliases).forEach(function (word) { lookup[word.toLowerCase()] = tag; });
    });
  });

  function parse(raw) {
    var result = { raw: String(raw || '').trim(), words: [], names: [], groups: {} };
    GROUPS.forEach(function (g) { result.groups[g.id] = []; });
    result.raw.split(/\s+/).filter(Boolean).forEach(function (word) {
      var tag = /^#./.test(word) ? lookup[word.slice(1).replace(/[,;]+$/, '').toLowerCase()] : null;
      if (!tag) {
        // A quoted tag ("#live") is ordinary search text.
        result.words.push(/^"#.+"$/.test(word) ? word.slice(1, -1) : word);
        return;
      }
      var list = result.groups[tag.group];
      if (tag.group === 'sort') list.length = 0;
      if (list.indexOf(tag) < 0) list.push(tag);
      if (result.names.indexOf(tag.name) < 0) result.names.push(tag.name);
    });
    result.text = result.words.join(' ');
    return result;
  }
  var has = function (list, name) { return list.some(function (tag) { return tag.name === name; }); };

  // Invidious search parameters for parsed tags. `feed` (the Search Groups feed) only shows videos.
  function params(t, page, feed) {
    var p = new URLSearchParams();
    var types = t.groups.type, text = t.text;
    if (has(types, 'shorts') && !/(^|\s)#shorts(\s|$)/i.test(text)) text = (text + ' #shorts').trim();
    if (!text) text = t.names.join(' ');
    p.set('q', text);
    var kinds = types.map(function (tag) { return tag.param; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    if (feed || (kinds.length === 1 && kinds[0] === 'video')) p.set('type', 'video');
    else if (kinds.length === 1) p.set('type', kinds[0]);
    else if (kinds.length > 1) p.set('type', 'all');
    var lengths = t.groups.length;
    if (lengths.length === 1) p.set('duration', lengths[0].param);
    else if (!lengths.length && types.length && types.every(function (tag) { return tag.name === 'shorts'; })) p.set('duration', 'short');
    if (t.groups.date.length) {
      p.set('date', t.groups.date.map(function (tag) { return tag.param; }).sort(function (a, b) { return DATE_ORDER.indexOf(b) - DATE_ORDER.indexOf(a); })[0]);
    }
    if (t.groups.sort.length) p.set('sort', t.groups.sort[0].param);
    if (t.groups.features.length) p.set('features', t.groups.features.map(function (tag) { return tag.param; }).join(','));
    if (page) p.set('page', String(page));
    return p;
  }

  function searchUrl(raw) {
    var t = parse(raw);
    if (!t.names.length) return null;
    var p = params(t, 0, false);
    p.set('pt_q', t.raw);
    return '/search?' + p.toString();
  }

  // Whether a video (seconds long, shape 'tall'/'square'/'wide'/'' when unknown) matches the tags.
  function videoMatches(t, seconds, shape, wantKinds) {
    var types = t.groups.type;
    if (types.length && wantKinds) {
      var plain = types.some(function (tag) { return ['videos', 'movies', 'shows'].indexOf(tag.name) >= 0; });
      // Shorts (2026-10-14): Invidious's own Short duration filter (under 4 minutes) does the finding; here only the
      // length is checked (3 minutes at most). The tile's picture shape is no longer needed, so nothing waits for
      // pictures to load and no result page ends up empty while the wall keeps fetching more pages.
      var short = has(types, 'shorts') && seconds > 0 && seconds <= 180;
      if (!plain && !short) return false;
    }
    if (t.groups.length.length && seconds > 0 && !t.groups.length.some(function (tag) { return seconds >= tag.min && seconds < tag.max; })) return false;
    if (t.groups.shape.length && shape && !has(t.groups.shape, shape)) return false;
    return true;
  }

  window.ptSearchTags = {
    groups: GROUPS,
    parse: parse,
    searchUrl: searchUrl,
    apiParams: function (raw, page) { var t = parse(raw); return t.names.length ? params(t, page, true) : null; },
    apiKeep: function (raw, video) { var t = parse(raw); return !t.names.length || videoMatches(t, Number(video.lengthSeconds) || 0, '', true); }
  };

  var url = new URL(location.href);
  // A search link with tags in it (a search term chip, a bookmark): open the tagged search instead.
  if (url.pathname === '/search' && !url.searchParams.has('pt_q')) {
    var raw = url.searchParams.get('q') || url.searchParams.get('search_query') || '';
    var target = searchUrl(raw);
    if (target) { window.ptTagsRedirect = true; location.replace(target); return; }
  }

  // Searching from the box: tags become filters.
  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!(form instanceof HTMLFormElement) || form.getAttribute('action') !== '/search') return;
    var input = form.querySelector('[name="q"], [name="search_query"]');
    var target = input && searchUrl(input.value);
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    location.assign(target);
  }, true);

  var tagged = url.pathname === '/search' && url.searchParams.has('pt_q') ? parse(url.searchParams.get('pt_q')) : null;

  // On a tagged results page: the search box shows what was typed, and tiles that don't match are hidden.
  function showTypedSearch() {
    if (!tagged) return;
    document.querySelectorAll('form[action="/search"] input[name="q"]').forEach(function (input) {
      if (document.activeElement !== input) input.value = tagged.raw;
    });
    document.title = tagged.raw + ' - Invidious';
  }
  function cardKind(card) {
    if (card.classList.contains('pt-video')) return 'video';
    var link = card.querySelector('a[href]');
    var href = link ? link.getAttribute('href') : '';
    if (/^\/playlist\?/.test(href)) return 'playlist';
    if (/^\/(channel\/|@)/.test(href)) return 'channel';
    return 'other';
  }
  function cardShape(card) {
    if (card.classList.contains('pt-pending')) return '';
    if (card.classList.contains('pt-tall')) return 'tall';
    if (card.classList.contains('pt-square')) return 'square';
    return 'wide';
  }
  function matches(card) {
    var kind = cardKind(card), types = tagged.groups.type;
    if (kind === 'video') {
      var thumb = card.querySelector('.pt-thumb');
      return videoMatches(tagged, Number(thumb && thumb.dataset.ptLength) || 0, cardShape(card), true);
    }
    if (!types.length) return true;
    return (kind === 'channel' && has(types, 'channels')) || (kind === 'playlist' && has(types, 'playlists'));
  }
  function hiddenFeed() {
    try { return (JSON.parse(localStorage.getItem('pt-hidden-feed-v1') || '[]') || []).map(function (v) { return v && v.id; }); } catch (e) { return []; }
  }
  var frame = 0;
  function filterTiles() {
    frame = 0;
    if (!tagged) return;
    var changed = false;
    document.querySelectorAll('.pt-wall > .pt-card, .pt-wall > .pure-u-1, .pt-wall > .pure-u-md-1-4').forEach(function (card) {
      if (!card.matches('.pt-card')) return;
      var keep = matches(card);
      if (!keep) {
        if (card.dataset.ptTagHidden !== 'true' || !card.hidden) { card.dataset.ptTagHidden = 'true'; card.hidden = true; changed = true; }
      } else if (card.dataset.ptTagHidden) {
        delete card.dataset.ptTagHidden;
        var thumb = card.querySelector('.pt-thumb');
        card.hidden = !!thumb && hiddenFeed().indexOf(thumb.dataset.ptId) >= 0; // still hidden if X-ed away
        changed = true;
      }
    });
    if (changed) window.dispatchEvent(new Event('resize'));
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(filterTiles); }
  function start() {
    showTypedSearch();
    if (!tagged) return;
    filterTiles();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    document.addEventListener('continuous:appended', schedule);
    window.addEventListener('load', showTypedSearch);
    setTimeout(showTypedSearch, 600);
  }

  // Menu: every tag, grouped, with what it does. Click one to add it to the search box.
  function tagGuide() {
    if (new URLSearchParams(location.search).get('pt_page') !== 'menu') return;
    var page = document.querySelector('main.pt-account-page');
    if (!page) { if ((tagGuide.tries = (tagGuide.tries || 0) + 1) < 40) setTimeout(tagGuide, 100); return; }
    if (page.querySelector('.pt-search-tags')) return;
    var section = document.createElement('section');
    section.className = 'pt-search-tags pt-guide-built';
    section.dataset.ptOrder = '30';
    section.setAttribute('aria-labelledby', 'pt-search-tags-title');
    var title = document.createElement('h2');
    title.id = 'pt-search-tags-title';
    title.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4 7 20M17 4l-2 16M4 9h16M3.5 15h16"/></svg>';
    title.append('Search tags');
    section.append(title);
    [
      'Type tags into the search box with your words, like titanfall #shorts #week. Capitals don’t matter.',
      'Tags in the same group are alternatives: #channels #playlists shows both. Different groups narrow each other: #shorts #week shows Shorts from this week. Quality tags must all match: #4k #hdr.',
      'Tags work in search terms and search groups too. Unknown tags stay part of the search; put a tag in quotes, like "#live", to search for the word itself.'
    ].forEach(function (text) { var p = document.createElement('p'); p.textContent = text; section.append(p); });
    var hint = document.createElement('p');
    hint.className = 'pt-search-tags-hint';
    hint.textContent = 'Click a tag to add it to the search box, then press Enter.';
    section.append(hint);
    GROUPS.forEach(function (group) {
      var block = document.createElement('div');
      block.className = 'pt-search-tags-group';
      var h3 = document.createElement('h3');
      h3.textContent = group.name;
      var note = document.createElement('p');
      note.className = 'pt-search-tags-note';
      note.textContent = group.help;
      var row = document.createElement('div');
      row.className = 'pt-search-tags-row';
      group.tags.forEach(function (tag) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'pt-search-tag';
        var label = document.createElement('strong');
        label.textContent = '#' + tag.name;
        var what = document.createElement('span');
        what.textContent = tag.help;
        chip.append(label, what);
        if (tag.aliases.length) {
          var also = document.createElement('small');
          also.textContent = 'also ' + tag.aliases.map(function (a) { return '#' + a; }).join(' ');
          chip.append(also);
        }
        chip.title = 'Add #' + tag.name + ' to the search box';
        chip.addEventListener('click', function () {
          var input = document.querySelector('.pt-search input[name="q"]') || document.querySelector('form[action="/search"] input[name="q"]');
          if (!input) return;
          var words = input.value.trim().split(/\s+/).filter(Boolean);
          if (!words.some(function (w) { return w.toLowerCase() === '#' + tag.name; })) words.push('#' + tag.name);
          input.value = words.join(' ');
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        });
        row.append(chip);
      });
      block.append(h3, note, row);
      section.append(block);
    });
    var later = Array.prototype.slice.call(page.children).filter(function (n) { return n.dataset && n.dataset.ptOrder && Number(n.dataset.ptOrder) > 30; })[0];
    if (later) page.insertBefore(section, later); else page.append(section);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { start(); tagGuide(); });
  else { start(); tagGuide(); }
}());
