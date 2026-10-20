/* Contextual first steps, shown only when a video wall is empty. */
;(() => {
  'use strict';
  const ID = 'pt-empty-tutorial';
  const $ = selector => document.querySelector(selector);
  const node = (tag, cls, text) => {
    const n = document.createElement(tag); if (cls) n.className = cls;
    if (text) n.textContent = text; return n;
  };
  const artwork = {restore:'restore-meme',playlists:'welcome',discover:'thinking',subscriptions:'ideas',followingfeed:'ideas',history:'history',hidden:'hidden',following:'following-trophy-down',terms:'terms',search:'search',youtube:'youtube'};
  const key = text => node('kbd', '', text);
  function words(parent, parts) {
    for (const part of parts) parent.append(typeof part === 'string' ? document.createTextNode(part) : key(part.key));
    return parent;
  }
  const copy = {
    playlists: {
      label: 'A little help getting started · Playlists',
      title: 'Hello! You’re on the star page.',
      intro: 'This is your saved-video collection: things to watch later, favorites to return to, and finds from your travels. All Lists combines every playlist and shows each video once.',
      nudge: 'Start with the rectangle next to the star, in the top left. It shows the playlist you’re saving to.',
      steps: [
        { keys: ['R'], title: 'Make it yours', text: 'Click the playlist rectangle, point at a name in the list, then press ', key: 'R', after: ' to rename it.' },
        { keys: ['A'], title: 'Make room for something new', text: 'With that list open, press ', key: 'A', after: ' to add a playlist. Make one for a topic, a mood, or your next rabbit hole.' },
        { keys: ['X', 'X'], title: 'Let a playlist go', text: 'Point at a named playlist and press ', key: 'X', after: ' twice to delete it. All Lists is always kept and cannot be renamed.' }
      ],
      footer: ['Ready to collect? Search for something you like. Hover a video and press ', {key:'A'}, ' to save it to your active playlist.'],
      action: 'Open playlist controls', target: '.pt-active-playlist',
      secondary: 'Find your first video', search: true
    },
    discover: {
      label: 'A little help getting started · Search Groups',
      title: 'Hello! Let’s give this feed a few interests.',
      intro: 'This is your Search Groups Feed. Each group mixes videos from its own terms. All Groups combines terms from every search group, counting shared terms once.',
      nudge: 'The rectangle next to the magnifying glass is your search group. It starts out as “Recommended” — you get to decide what that means.',
      steps: [
        { keys: ['R'], title: 'Name your group', text: 'Click the group rectangle, point at a name, then press ', key: 'R', after: ' to rename it. Use A in that same list to make another group.', extraKeys: true },
        { keys: ['A'], title: 'Give it an interest', text: 'Point at the dotted interests bar beside Search and press ', key: 'A', after: ' to add a search term. Try a hobby, a creator, or a topic you’re curious about.' },
        { keys: ['I'], title: 'Add a whole handful', text: 'Point at the interests bar and press ', key: 'I', after: ' to paste or edit several terms. Then open the magnifying-glass feed again.' }
      ],
      footer: ['All Groups is always kept. Choose a named search group before adding or editing terms. Hover a video and press ', {key:'A'}, ' to save it in a named playlist.'],
      action: 'Open search-group controls', target: '.pt-active-group',
      secondary: 'Browse a search first', search: true
    },
    subscriptions: {
      label: 'A little help getting started · Subscriptions',
      title: 'Hello! This feed starts with your people.',
      intro: 'Your Subscriptions Feed brings together videos from creators you choose to follow. Follow a few people and this empty space becomes your own channel.',
      nudge: 'Start with a search, open a creator’s page, then point at their picture. Following here stays inside Individuous.',
      steps: [
        { keys: ['A'], title: 'Follow someone you like', text: 'On a creator’s page, point at their picture and press ', key: 'A', after: ' to follow. Their videos can now appear in this feed.' },
        { keys: ['I'], title: 'Bring your own list', text: 'Point at the person icon in the top right and press ', key: 'I', after: ' to paste channel links, @handles, or channel IDs — one per line.' },
        { keys: ['A'], title: 'Keep the good finds', text: 'When your feed has videos, hover one and press ', key: 'A', after: ' to save it. The star at the top left takes you to your collection.' }
      ],
      footer: ['You can also use the magnifying-glass Search Groups Feed to explore topics before following anyone.'],
      action: 'Find creators', search: true,
      secondary: 'Explore search groups', href: '/search?pt_page=discover'
    }
  };
  Object.assign(copy, {
    followingfeed: {
      label:'A little help getting started · Following group',title:'A new feed for your favorite people.',
      intro:'This following group has no videos to show yet. Choose which creators belong here, then the play button beside Following opens a feed from just those people.',
      nudge:'Your group name sits beside the play button at the top right. All Creators always contains everyone you follow. A creator can belong to several groups.',
      steps:[
        {keys:['A'],title:'Make a group',text:'Point at the following-group name and press ',key:'A',after:' to create a group. Open its list to rename or delete a custom group.'},
        {keys:['I'],title:'Choose its creators',text:'Point at the following-group name and press ',key:'I',after:' to select creators you already follow. Save, then open its play button.'},
        {keys:['G'],title:'Organize a creator',text:'On the Following page, point at a creator and press ',key:'G',after:' to choose all their groups.'}
      ],
      footer:['Deleting a group preserves your follows and saved videos.'],
      action:'Choose group creators',members:true,secondary:'Open Following',href:'/subscription_manager'
    },
    restore: {
      label:'A little help getting started · Restore Feed', title:'Hello again! Pick up where you left off.',
      intro:'The diamond brings back the last feed or search wall saved in this browser tab, keeping its videos and your scroll position. It is a little bookmark for your current wanderings.',
      nudge:'There are no videos in this restored wall yet. Start with a search, explore a search group, or visit your Subscriptions Feed to find something to watch.',
      steps:[
        {keys:['Enter'],title:'Start a trail',text:'Type a topic or creator in Search and press ',key:'Enter',after:' to find videos. Open one, then use the diamond at the top right to return to that wall.'},
        {keys:['A'],title:'Keep a find for later',text:'When videos appear, hover a tile and press ',key:'A',after:' to save it in your active playlist. The star opens your saved collection.'}
      ],
      footer:['Restore Feed remembers one wall in this browser tab. Opening another feed or search updates that memory.'],
      action:'Find something to watch',search:true,secondary:'Explore search groups',href:'/search?pt_page=discover'
    },
    history: {
      label:'A little help getting started · History', title:'Hello! Your travels leave a trail.',
      intro:'This is your watch history. Videos you open can appear here so you can find your way back to something good. There are no videos on this page right now.',
      nudge:'Search for a video and open it to begin. The Watch history switch in Menu lets you pause recording whenever you like.',
      steps:[
        {keys:['A'],title:'Keep more than a memory',text:'When you find a video worth keeping, hover it and press ',key:'A',after:' to save it in your active playlist.'},
        {keys:['X','X'],title:'Take something out',text:'On a history tile, press ',key:'X',after:' twice to remove that entry from history. This does not delete the video from YouTube.'}
      ],
      footer:['Hold ',{key:'Ctrl'},' and click a video’s main area to open it on YouTube.'],
      action:'Find something to watch',search:true,secondary:'Open your collection',href:'/star.html'
    },
    hidden: {
      label:'A little help getting started · Hidden videos', title:'Nothing hiding here. A good place to start.',
      intro:'Videos you hide from feeds and searches live here. Hiding helps you skip things you have finished, or things you simply do not want to see again.',
      nudge:'This page starts empty. Hiding only changes what you see in Individuous; it does not delete anything from YouTube.',
      steps:[
        {keys:['X','X'],title:'Hide something from a feed',text:'Point at a video in a feed or search and press ',key:'X',after:' twice to send it here.'},
        {keys:['X','X'],title:'Change your mind',text:'On this page, point at a hidden video and press ',key:'X',after:' twice to restore it to your feeds and searches.'}
      ],
      footer:['To restore everything here, press ',{key:'Ctrl'},' + ',{key:'Shift'},' + ',{key:'X'},' twice.'],
      action:'Find videos',search:true,secondary:'Explore search groups',href:'/search?pt_page=discover'
    },
    following: {
      label:'A little help getting started · Following groups', title:'Your creators, organized into feeds.',
      intro:'All Creators shows everyone you follow and is always kept. Make named groups for different interests; a creator can belong to several groups. The play button opens the selected group’s video feed.',
      nudge:'The rectangle beside Play at the top right chooses your creator group. Use the person icon to return here to organize creators. The introduction appears here only while the selected group is empty.',
      steps:[
        {keys:['A'],title:'Create a creator group',text:'Point at the creator-group rectangle and press ',key:'A',after:' to make a group. Choose its name in the list to switch feeds.'},
        {keys:['I'],title:'Choose who belongs',text:'Point at a named creator group and press ',key:'I',after:' to choose its creators. Over the person icon, this edits the full follow list instead.'},
        {keys:['G'],title:'Put a creator in several groups',text:'Point at a creator here and press ',key:'G',after:' to choose every group they belong to. Follow new creators from their pages, or import them with the person icon.'}
      ],
      footer:['In the group list, ',{key:'R'},' renames a custom group and ',{key:'X'},' twice deletes it. All Creators cannot be renamed or deleted. On a creator tile, ',{key:'X'},' twice removes only membership in a named group; in All Creators it unfollows.'],
      action:'Find creators',search:true,secondary:'Open subscriptions feed',href:'/feed/subscriptions'
    },
    terms: {
      label:'A little help getting started · Search terms', title:'Keep a few good ideas in your pocket.',
      intro:'These are the interests in your active search group. Each word or phrase becomes a source for your Search Groups Feed. Start with things you would love to stumble across.',
      nudge:'Open Search Groups to choose a group. Here, point over the page away from the top bar to add or edit that group’s terms.',
      steps:[
        {keys:['A'],title:'Write down one interest',text:'Point over this page and press ',key:'A',after:' to add a word or phrase.'},
        {keys:['I'],title:'Fill a whole page',text:'Point over this page and press ',key:'I',after:' to paste or edit several search terms at once.'},
        {keys:['X','X'],title:'Let an interest go',text:'Point at a term and press ',key:'X',after:' twice to remove it from this group.'}
      ],
      footer:['The magnifying glass opens a feed made from these interests.'],
      action:'Open search groups',primaryHref:'/search?pt_page=discover',secondary:'Try a search first',search:true
    },
    search: {
      label:'A little help getting started · Search', title:'No matches this time. Try another trail.',
      intro:'This search did not return any matches. Try fewer words, another phrase, or fewer filter tags. There is still plenty to explore.',
      nudge:'The Search field stays at the top. You can change the words there without changing your saved search groups.',
      steps:[
        {keys:['Enter'],title:'Try a fresh search',text:'Type a different phrase in Search, then press ',key:'Enter',after:' to look again.'},
        {keys:['A'],title:'Keep your next good find',text:'When you find a video you like, hover it and press ',key:'A',after:' to save it to your active playlist.'}
      ],
      footer:['Hold ',{key:'Ctrl'},' and click the main area of a video to open it on YouTube.'],
      action:'Try another search',search:true,secondary:'Explore your interests',href:'/search?pt_page=discover'
    },
    youtube: {
      label:'A little help getting started · Your YouTube feed', title:'A little room for your YouTube feed.',
      intro:'No personal recommendations are showing here yet. Connect your own YouTube session in Menu, or try Refresh feed if you are already connected.',
      nudge:'This connection is optional. Your local collections, creator follows and search groups are separate and still work on their own.',
      steps:[
        {keys:['A'],title:'Collect something you love',text:'Once videos appear, hover one and press ',key:'A',after:' to save it in your local playlist.'},
        {keys:['S'],title:'Mix what you have loaded',text:'Point over the loaded video wall and press ',key:'S',after:' to shuffle it. Refresh feed asks YouTube for a fresh page.'}
      ],
      footer:['Any connection or loading message remains below, along with the refresh controls.'],
      action:'Open YouTube connection',primaryHref:'/feed/subscriptions?pt_page=menu',secondary:'Explore search groups',href:'/search?pt_page=discover'
    }
  });
  function focusSearch() {
    const input = $('.pt-search input[name="q"]');
    if (input) { input.focus(); input.select(); }
  }
  function action(cfg, secondary = false) {
    const href = secondary ? cfg.href : cfg.primaryHref;
    const button = node(href ? 'a' : 'button', 'pt-welcome-action' + (secondary ? ' pt-welcome-secondary' : ''), secondary ? cfg.secondary : cfg.action);
    if (href) button.href = href;
    else {
      button.type = 'button';
      button.onclick = () => {
        if (!secondary && cfg.members) window.ptFollowingGroups?.editMembers();
        else if (!secondary && cfg.target) $(cfg.target)?.click(); else focusSearch();
      };
    }
    return button;
  }
  function create(kind) {
    let cfg = copy[kind];
    if (kind === 'following') {
      try {
        const group = window.ptFollowingGroups?.active();
        if (group && group.id !== 'all') cfg = {
          ...cfg,label:'A little help getting started · Following group',title:'Who belongs in “' + group.name + '”?',
          intro:'This group has no creators yet. Choose people you already follow to build a separate feed for a topic, a mood, or a new rabbit hole.',
          nudge:'All Creators still holds everyone you follow. A creator can be in several groups, and deleting a group preserves your follows.',
          steps:[
            {keys:['I'],title:'Choose this group’s creators',text:'Point at the following-group name beside the play button and press ',key:'I',after:' to choose creators, then Save.'},
            {keys:['G'],title:'Organize from All Creators',text:'Switch to All Creators, point at a creator and press ',key:'G',after:' to choose every group they belong to.'}
          ],action:'Choose group creators',members:true,secondary:'Open this group’s feed',href:'/feed/subscriptions?' + new URLSearchParams({pt_following:group.id})
        };
      } catch (_) { /* The group status remains visible. */ }
    }
    const section = node('section', 'pt-empty-tutorial'); section.id = ID;
    section.dataset.kind = kind; section.setAttribute('aria-labelledby', 'pt-welcome-title');
    const art = node('div', 'pt-welcome-art');
    const img = node('img'); img.src = '/tutorial-' + artwork[kind] + '.png';
    img.alt = ''; img.width = 240; img.height = 420; img.decoding = 'async';
    art.append(img);
    const content = node('div', 'pt-welcome-copy');
    const eyebrow = node('p', 'pt-welcome-eyebrow', cfg.label);
    const heading = node('h1', '', cfg.title); heading.id = 'pt-welcome-title';
    content.append(eyebrow, heading, node('p', 'pt-welcome-intro', cfg.intro), node('p', 'pt-welcome-nudge', cfg.nudge));
    const list = node('ol', 'pt-welcome-steps');
    for (const step of cfg.steps) {
      const item = node('li', 'pt-welcome-step');
      const caps = node('div', 'pt-welcome-caps'); caps.setAttribute('aria-hidden', 'true');
      for (const name of step.keys) caps.append(key(name));
      const body = node('div'); body.append(node('h2', '', step.title));
      const description = node('p');
      if (step.extraKeys) {
        words(description, [step.text, {key:step.key}, ' to rename it. Use ', {key:'A'}, ' in that same list to make another group.']);
      } else words(description, [step.text, {key:step.key}, step.after]);
      body.append(description); item.append(caps, body); list.append(item);
    }
    content.append(list, words(node('p', 'pt-welcome-footer'), cfg.footer));
    const actions = node('div', 'pt-welcome-actions'); actions.append(action(cfg), action(cfg, true));
    content.append(actions); section.append(art, content); return section;
  }
  function show(kind, empty, hideStatus = true) {
    const sourceKind = kind;
    if (kind === 'subscriptions') {
      try { if (window.ptFollowingGroups && window.ptFollowingGroups.active().id !== 'all') kind = 'followingfeed'; } catch (_) { /* Feed status reports invalid group data. */ }
    }
    const contents = $('#contents');
    let wall = kind === 'playlists' ? $('#pt-star-wall') : kind === 'terms' ? $('#pt-term-manager .pt-term-wall') : kind === 'search' ? $('#contents .no-results-error') : $('#contents .pt-wall');
    if (['history','following'].includes(kind) && contents) {
      wall = $('#pt-empty-anchor');
      if (!wall) { wall = node('div'); wall.id = 'pt-empty-anchor'; contents.append(wall); }
    }
    if (['discover','subscriptions','followingfeed','search','youtube'].includes(kind) && new URLSearchParams(location.search).get('pt_restore') === '1') kind = 'restore';
    if (!wall || !copy[kind]) return;
    let section = document.getElementById(ID);
    if (section && section.dataset.kind !== kind) { section.remove(); section = null; }
    if (!empty) { section?.remove(); }
    else if (!section) { section = create(kind); wall.before(section); }
    const note = sourceKind === 'playlists' ? $('#pt-star-note') : sourceKind === 'hidden' ? $('#contents .pt-hidden-status') : sourceKind === 'terms' ? $('#pt-term-manager .pt-terms-empty') : sourceKind === 'search' ? wall : $('#contents .continuous-status');
    if (note) note.classList.toggle('pt-welcome-suppressed', empty && hideStatus);
  }
  window.ptEmptyGuide = { show };
  function start() {
    // Playlist rendering can finish before this script is reached on deferred pages.
    if (location.pathname === '/star.html') {
      try {
        const stored = JSON.parse(localStorage.getItem('pt-video-lists-v1'));
        const data = stored && window.ptAggregateGroups.combine(stored,'items');
        const active = data?.lists?.find(list => list.id === data.activeId);
        if (active) show('playlists', active.items.length === 0);
      } catch (_) { /* Existing saved-list error remains visible. */ }
    }
    const termsWall = $('#pt-term-manager .pt-term-wall');
    if (termsWall) show('terms', !termsWall.querySelector('.pt-term-tile'));
    let staticKind = null;
    if (location.pathname === '/feed/history' && $('#watched_data')) staticKind = 'history';
    if (location.pathname === '/subscription_manager' && [...document.querySelectorAll('#contents a[href="/feed/history"]')].some(link => !link.closest('.pt-header'))) staticKind = 'following';
    if (location.pathname === '/search' && !new URLSearchParams(location.search).get('pt_page') && $('#contents .no-results-error')) staticKind = 'search';
    if (staticKind) {
      const contents = $('#contents');
      const sync = () => {
        const populated = staticKind === 'following' ? [...contents.querySelectorAll('.pt-subscription,form[action^="/subscription_ajax"],.h-box a[href^="/channel/"]')].some(el => !el.closest('[hidden]')) : contents.querySelector('div.thumbnail');
        show(staticKind, !populated);
      };
      sync();
      let scheduled = false;
      new MutationObserver(() => {
        if (scheduled) return; scheduled = true;
        requestAnimationFrame(() => { scheduled = false; sync(); });
      }).observe(contents, {childList:true,subtree:true});
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
})();
