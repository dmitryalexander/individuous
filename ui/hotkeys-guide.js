;
/* Menu tutorial boxes (October 15, 2026): the Menu page explains the YouTube app in boxed sections, in this order:
   Favorites, Videos, Feed, Search tags (built by search-tags.js), Search groups, Following creators, Hidden videos, History.
   Text only; the behavior lives in pinless-look.js, interest-bar.js, random-feed.js and subscription-import.js.
   The "try it" buttons click the real playlist and group names in the header. Each box carries data-pt-order and
   inserts itself before the first box with a higher number, so the boxes stay in order whichever script finishes first. */
(function () {
  'use strict';
  if (new URLSearchParams(location.search).get('pt_page') !== 'menu') return;
  function el(tag, className, text) { var n = document.createElement(tag); if (className) n.className = className; if (text) n.textContent = text; return n; }
  function keys(names) {
    var box = document.createDocumentFragment();
    names.forEach(function (name, i) { if (i) box.append(' + '); box.append(el('kbd', '', name)); });
    return box;
  }
  function card(keyNames, title, text) {
    var box = el('div', 'pt-hotkeys-card'), top = el('div');
    top.append(keys(keyNames));
    box.append(top, el('strong', '', title), el('span', '', text));
    return box;
  }
  /* A card with a title and text but no key (where something lives, or a way to do it). */
  function info(title, text) {
    var box = el('div', 'pt-hotkeys-card');
    box.append(el('strong', '', title), el('span', '', text));
    return box;
  }
  function zone(color, title, text) {
    var box = el('div', 'pt-hotkeys-card');
    box.dataset.zone = color;
    box.append(el('strong', '', title), el('span', '', text));
    return box;
  }
  /* A card headed by an icon instead of a key (the three feed orders). */
  function modeCard(svg, title, good, text) {
    var box = el('div', 'pt-hotkeys-card pt-hotkeys-mode'), top = el('div', 'pt-hotkeys-mode-icon');
    top.innerHTML = svg;
    box.append(top, el('strong', '', title), el('em', '', good), el('span', '', text));
    return box;
  }
  function row() { var r = el('div', 'pt-hotkeys-row'); Array.prototype.slice.call(arguments).forEach(function (c) { r.append(c); }); return r; }
  function note(text) { return el('p', 'pt-hotkeys-note', text); }
  function tryButton(text, selector) {
    var b = el('button', 'pt-hotkeys-try', text); b.type = 'button';
    b.addEventListener('click', function () { var target = document.querySelector(selector); if (target) target.click(); });
    return b;
  }
  function linkButton(text, href) {
    var a = el('a', 'pt-hotkeys-try', text); a.href = href;
    return a;
  }
  function svg(paths) {
    return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }
  var ICONS = {
    star: svg('<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>'),
    video: svg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9.5 5 2.5-5 2.5Z"/>'),
    feed: svg('<path d="m9 6 9 6-9 6Z"/>'),
    groups: svg('<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5.5 5.5"/>'),
    hidden: svg('<path d="m3 3 18 18M2 12s4-7 10-7c6 0 10 7 10 7s-4 7-10 7S2 12 2 12Z"/>'),
    follow: svg('<circle cx="9" cy="8" r="4"/><path d="M2 21v-2a6 6 0 0 1 12 0v2M19 8v6M16 11h6"/>'),
    history: svg('<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5M3.5 4v4.5H8"/><path d="M12 7.5V12l3 2"/>')
  };
  var ORDER_ICONS = {
    newest: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 16 4 4 4-4M7 20V4M11 4h10M11 8h7M11 12h4"/></svg>',
    random: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
    oldest: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 8 4-4 4 4M7 4v16M11 12h4M11 16h7M11 20h10"/></svg>'
  };

  /* A boxed section with an icon title; placed by its order number. */
  function box(id, order, icon, name, intro) {
    var s = el('section', 'pt-guide pt-hotkeys');
    s.id = id; s.dataset.ptOrder = String(order);
    s.setAttribute('aria-labelledby', id + '-title');
    var h = el('h2'); h.id = id + '-title'; h.innerHTML = icon; h.append(name);
    s.append(h);
    if (intro) intro.forEach(function (t) { s.append(el('p', '', t)); });
    return s;
  }
  function place(page, section) {
    var order = Number(section.dataset.ptOrder);
    var later = Array.prototype.slice.call(page.children).filter(function (n) { return n.dataset && n.dataset.ptOrder && Number(n.dataset.ptOrder) > order; })[0];
    if (later) page.insertBefore(section, later); else page.append(section);
  }

  function favorites() {
    var s = box('pt-guide-favorites', 10, ICONS.star, 'Favorites', [
      'Favorites are the videos you keep. They live in playlists: you can make as many as you like. Open them with the star at the top left. One playlist is always the active one; its name sits right next to the star.']);
    s.append(el('h3', '', 'All Lists'),
      note('Choose All Lists in the playlist list to see saved videos from every playlist, with duplicates shown once. This combined view is always kept and cannot be renamed or deleted. Choose a named playlist before saving, moving, removing or shuffling videos; All Lists does not change several playlists at once.'));
    s.append(el('h3', '', 'Saving a video'),
      el('p', '', 'Point at any video (your feed, a search, History, a creator’s page) and press A. It goes into the active playlist and a quick flash confirms it. Press A again and it comes back out. A video can be in several playlists at once.'),
      el('p', '', 'Once a video is saved anywhere, pointing at it shows a green border instead of the usual gray one, so you can tell at a glance what you already have.'));
    s.append(el('h3', '', 'Choosing and managing playlists'),
      note('Click the playlist name next to the star (or Tab to it and press Enter, Space or ↓). Click a playlist, or use ↑ ↓ Home End and Enter, to choose where A saves. Esc closes the list.'));
    s.append(row(
      card(['A'], 'New playlist', 'With the list open, press A (or press A while pointing at the closed name). Type a name, Enter to save, Esc to cancel. The new playlist becomes the active one.'),
      card(['R'], 'Rename', 'Point at a playlist in the open list, or reach it with the arrow keys, and press R. Enter saves, Esc cancels.'),
      card(['X'], 'Delete', 'Point at a playlist and press X. The row turns red; press X again within a few seconds to delete it. All Lists is always kept; it cannot be renamed or deleted.')));
    s.append(note('Keep the mouse on the list while you press a key: if you move it onto the page, the list closes and the key goes to the page instead. Playlist names must be different (capitals don’t matter).'));
    s.append(tryButton('Open the playlist list to try it', '.pt-active-playlist'));
    s.append(el('h3', '', 'On the Playlists page'),
      note('It shows the videos of the active playlist. Point at a video and press a key:'));
    s.append(row(
      card(['A'], 'Move to another playlist', 'Picks the video up and opens the list; click a playlist to move it there. A again cancels.'),
      card(['X'], 'Remove from this playlist', 'Press X, then X again. The video leaves only this playlist; other playlists that hold it are untouched.'),
      card(['S'], 'Shuffle', 'Mixes the order and keeps the new order. Each shuffle replaces the last.')));
    return s;
  }

  function videos() {
    var s = box('pt-guide-videos', 20, ICONS.video, 'Videos', [
      'Point the mouse at a video in your feed, a search, a playlist, History or a creator’s page, and a coloured border shows what a click will do. Keys are ignored while you type in a box or a pop-up is open.']);
    s.append(row(
      zone('red', 'Top strip', 'Click to copy the video link and open YTUltra, then paste it there. Ctrl-click (⌘-click on Mac) opens the transcript.'),
      zone('blue', 'Second strip', 'Click to open the video page. Ctrl-click opens it in a new tab.'),
      zone('gray', 'The rest', 'Click to play right in the tile, click again to pause. Ctrl-click this main area to open the video on YouTube in a new tab. Rest the mouse here for a moment for a silent preview (Menu > Hover previews). The border turns green if the video is already in one of your playlists.')));
    var youtubeShortcut = card(['Ctrl'], 'Open on YouTube', 'Hold Ctrl and click the main area of a video tile, or the main player on its watch page, to open that video on YouTube. The red strip uses Ctrl-click for transcripts; the blue strip uses Ctrl-click for a new Individuous tab.');
    youtubeShortcut.classList.add('pt-hotkeys-wide'); s.append(youtubeShortcut);
    s.append(row(
      card(['A'], 'Save or unsave', 'Adds the video to your active playlist. Press A again to take it out.'),
      card(['S'], 'Shuffle', 'With the mouse over the videos: on your feed it draws a different batch, on a search or creator page it reshuffles the videos loaded so far, on a watch page it mixes the related videos while keeping the main player in place, and on a playlist it shuffles and saves that order.'),
      card(['Z'], 'Fullscreen', 'For a video you clicked to play in the tile. Press Z again to leave fullscreen.'),
      card(['+', '−'], 'Volume', 'Up or down by a tenth while a video plays in the tile or on its own page.')));
    s.append(el('h3', '', 'Hiding a video you don’t want'),
      el('p', '', 'Point at a video in your feed, a search or Discover and press X: the picture turns red with “Press X again to hide”. Press X again and the video disappears from your feed and from every search. Esc, or moving the mouse off it, cancels the first press.'),
      el('p', '', 'Nothing is deleted from YouTube; it is only hidden in this browser. The round Hidden videos button above opens the Hidden videos page, and the Hidden videos box below explains bringing them back one by one or all at once.'));
    s.append(row(card(['X'], 'Hide from feed and searches', 'Press it twice. The video stays gone until you restore it.')));
    return s;
  }

  function feed() {
    var s = box('pt-guide-feed', 25, ICONS.feed, 'Feed', [
      'The Feed is the wall of videos you browse. Three walls work the same way: your Subscriptions Feed (the play button beside Following at the top right, and the page the app opens on), the Search Groups Feed (the magnifying glass next to the search group’s name) and any search you run. Each one keeps going: the Subscriptions Feed and searches load more as you scroll, and the Search Groups Feed has a Load more button at the bottom.']);
    s.append(el('h3', '', 'Where the videos come from'));
    s.append(row(
      info('Subscriptions Feed', 'Videos from the creators you follow. It takes turns between them, so one busy creator can’t crowd out the rest, and fills each batch with 48 videos. The Following box below explains choosing creators and each creator’s feed order.'),
      info('Search Groups Feed', 'A mix of videos from every term in your active search group, woven together a few terms at a time. Load more fetches the next terms; Shuffle videos mixes what is already on the wall.'),
      info('A search', 'The results for what you typed in the search bar. The Search tags box shows how to narrow them with #shorts, #week, #4k and so on.')));
    s.append(el('h3', '', 'On the wall'),
      note('Point the mouse at a video: the coloured border shows what a click does (external tools, open or play; see the Videos box above). Keep the mouse over the wall and press a key. Keys are ignored while you type in a box or a pop-up is open, and they don’t work over the top bar.'));
    s.append(row(
      card(['A'], 'Save or unsave', 'Puts the video in your active playlist; press A again to take it out. A video already saved anywhere hovers green.'),
      card(['X'], 'Hide a video', 'Press X, then X again. The video disappears from every feed and search, and the Subscriptions Feed pulls in another to fill the gap. Esc or moving the mouse away cancels the first press.'),
      card(['S'], 'Shuffle', 'On the Subscriptions Feed it draws a different batch of 48. On a search or the Search Groups Feed it mixes the videos already loaded.'),
      card(['Z'], 'Fullscreen', 'For a video you clicked to play in its tile. Press Z again to leave fullscreen.'),
      card(['+', '−'], 'Volume', 'Up or down by a tenth while a video plays in its tile.')));
    s.append(el('p', '', 'Resting the mouse on the gray part of a video for a moment starts a silent preview (Menu > Hover previews turns it off). Previews never count as watching.'));
    s.append(el('h3', '', 'Keeping your place'),
      el('p', '', 'The diamond button at the top right (Restore Feed) brings back the last feed or search wall you looked at in this browser tab, with the same videos and scroll position. Use it after you open a video and want to get back to the wall you were on, especially a shuffled mix you can’t easily recreate.'));
    s.append(el('h3', '', 'What you won’t see'),
      el('p', '', 'Videos you hid with X stay out of every wall until you bring them back with the round Hidden videos button above. Videos you open are added to History, unless the Watch history switch above is off.'));
    return s;
  }

  function groups() {
    var s = box('pt-guide-groups', 40, ICONS.groups, 'Search groups', [
      'A search group is a named set of search terms. The group name sits next to the search box; the magnifying glass opens that group’s feed, a mix of videos from all its terms. Open the list the same way as the playlist list: click the name, then:']);
    s.append(note('All Groups is the protected combined search feed. It uses the terms from every search group, counting shared terms once. Choose a named group to add, edit or remove terms. All Groups cannot be renamed or deleted.'));
    s.append(row(
      card(['A'], 'New group', 'Press A with the list open, or while pointing at the closed group name. Type a name, Enter to save. The new group starts empty and becomes active.'),
      card(['R'], 'Rename', 'Point at a group (or arrow to it) and press R. Enter saves, Esc cancels.'),
      card(['X'], 'Delete', 'Point at a group and press X, then X again within a few seconds. All Groups cannot be renamed or deleted.')));
    s.append(note('Keep the mouse on the list while you press a key: if you move it onto the page, the list closes and the key goes to the page instead. Names must be different (capitals don’t matter).'));
    s.append(tryButton('Open the group list to try it', '.pt-active-group'));
    s.append(el('h3', '', 'Search terms in a group'),
      note('Point at the search term chips in the top bar and press a key.'));
    s.append(row(
      card(['A'], 'Add a term', 'A small box opens. Type a search, then Save.'),
      card(['I'], 'Import or edit all', 'Opens the whole list of terms in this group, to paste in many at once or fix them.'),
      card(['X'], 'Remove a term', 'Point at a chip and press X to mark it, X again to delete it.'),
      card(['Ctrl', 'Shift', 'X'], 'Delete all terms', 'Press it twice to empty the active group.'),
      card(['S'], 'Shuffle', 'Mixes the order of the chips.')));
    return s;
  }

  function following() {
    var s = box('pt-guide-following', 50, ICONS.follow, 'Following creators', [
      'Following a creator (YouTube calls it subscribing) puts their videos into your Subscriptions Feed (the play button beside Following at the top right). Who you follow is kept inside this app; you never sign in to YouTube. Follow a handful of creators and the feed becomes your own channel.']);
    s.append(el('h3', '', 'Following groups'),
      note('The rectangle beside the play button chooses a following group. All Creators always includes every creator you follow, including people in no custom group. It cannot be renamed or deleted. A creator can belong to several groups. Switching the group changes this feed, while the playlist on the left still controls where videos are saved.'));
    s.append(row(
      card(['A'], 'New following group', 'Point at the group name or open its list and press A. Type a name; Enter saves and Esc cancels.'),
      card(['R'], 'Rename a group', 'Open the group list, point at or arrow to a custom group and press R. Enter saves; Esc cancels.'),
      card(['X'], 'Delete a group', 'In the group list, press X twice on a custom group. Its creators remain followed. All Creators is always kept.'),
      card(['I'], 'Choose group creators', 'Point at the following-group name and press I. Select the creators for that feed and Save. Space toggles checkboxes; Tab moves; Esc cancels.'),
      card(['G'], 'A creator’s groups', 'On Manage subscriptions, point at a creator or focus their Groups button and press G. Choose all groups they belong to.')));
    s.append(el('h3', '', 'Following and unfollowing'),
      note('Go to a creator’s page. Their picture has a coloured ring: blue means you don’t follow them yet, green means you do. Point at the picture or the banner, or at the creator’s name on a video page, and press a key:'));
    s.append(row(
      card(['A'], 'Follow', 'Follows right away. The ring turns green and a quick flash confirms it. You can also just click the picture.'),
      card(['X'], 'Unfollow', 'Unfollows right away, with no second press, so be sure of what you are pointing at. Clicking the picture again does the same.')));
    s.append(el('h3', '', 'Choosing who to follow'),
      note('There is no recommended-creators list; you pick. Four ways to find and add people:'));
    s.append(row(
      info('From a video you like', 'Open the video and point at the creator’s name, then press A to follow without leaving the video. Press Enter on the empty name field, or click the name, to open their whole page first.'),
      info('From a search', 'Add #channels to a search (try woodworking #channels) to list creators instead of videos. Open one to look at their uploads, then press A on their picture.'),
      info('The whole list in one box', 'Point at the person button in the top bar (Subscriptions) and press I. A box opens, like the Recommended searches editor, filled with everyone you follow, one per line. Delete a line to unfollow that channel; type or paste YouTube links, @handles or channel IDs to follow more; then Save.'),
      info('Backing up and moving', 'Copy everything out of that box to keep a backup of who you follow, or paste a list from another browser to bring it in. Anything after “ #” on a line is just a note (the box writes each channel’s name there).')));
    s.append(el('h3', '', 'How it feeds your Subscriptions Feed'),
      el('p', '', 'The feed takes turns between the creators you follow, so one busy creator can’t crowd out the rest. Each batch holds 48 videos, and more load as you scroll. Press S with the mouse over the videos to draw a different batch. Videos you hid with X (twice) never show up again, and the feed fetches more to fill the gap.'));
    s.append(el('h3', '', 'Feed order for each creator'),
      el('p', '', 'On every creator’s page the top bar has three sections of the same weight: Videos, Shorts and Playlists; the sort pills; and Feed order, three round icons: a down arrow for Newest first, crossed arrows for Random and an up arrow for Oldest first. The current one is filled amber. Point at an icon to see its name and what it is good for, and click it to use that order. It is saved in this app. Each creator has their own; the default is Random.'));
    s.append(row(
      modeCard(ORDER_ICONS.newest, 'Newest first', 'Good for news', 'Latest uploads come first, so you see what just came out. Best for news and creators where only the new stuff matters.'),
      modeCard(ORDER_ICONS.random, 'Random', 'Good for retrospectives', 'Videos from the whole archive (old, new and popular) mixed in with your other creators. Best for rediscovering a channel, or looking back over years of it.'),
      modeCard(ORDER_ICONS.oldest, 'Oldest first', 'Good for tutorials', 'Starts at the very first upload and moves forward, like a course. Best for tutorial series you want to watch in order.')));
    s.append(el('p', 'pt-hotkeys-tip', 'Working through a course: set the creator to Oldest first, then press X twice on each lesson when you finish it. Hidden videos are skipped, so the next lesson moves up to the front and you go through the course one by one. (Hiding is only in this browser; the Hidden videos button above brings a lesson back.)'));
    s.append(el('p', 'pt-hotkeys-note', 'The order only affects your Subscriptions Feed, so it takes effect once you follow the creator (the picture ring turns green).'));
    s.append(el('h3', '', 'Where each setting lives'));
    s.append(row(
      info('Feed order', 'Per creator, on their page (the round button on their picture). Saved in this app.'),
      info('Hidden videos', 'Per video: X twice on the wall. The round Hidden videos button above opens the Hidden videos page (see the Hidden videos box below).'),
      info('Follow list', 'Press I over the person button for the editing box, or open the Manage subscriptions page to see everyone as pictures.')));
    s.append(el('p', '', 'The creator-group tutorial appears only on Manage subscriptions when its selected group is empty. Video feeds keep their space for videos and loading status.'));
    s.append(el('h3', '', 'Manage subscriptions'),
      note('The person button at the top right lists the creators in the selected following group, A to Z. Choose All Creators to see everyone. Point at a creator and press a key:'));
    s.append(row(
      card(['X'], 'Remove from this view', 'Press X twice. In All Creators this unfollows the creator. In a named group it removes only their group membership, keeping the follow.'),
      card(['I'], 'Edit the list', 'Opens the same box as pointing at the person button: everyone you follow, one per line, to edit, paste into and Save. (Over the term bar, I edits the search terms instead.)'),
      card(['S'], 'Shuffle', 'Mixes the order of the creators on the page.')));
    s.append(linkButton('Open Manage subscriptions', '/subscription_manager'));
    return s;
  }

  function hidden() {
    var s = box('pt-guide-hidden', 55, ICONS.hidden, 'Hidden videos', [
      'Hiding is how you say “not this one”. Point at a video in your feed, a search or the Search Groups Feed and press X, then X again: the picture turns red after the first press (Esc cancels) and the video disappears from every feed and every search after the second. Nothing is deleted from YouTube; the video is only hidden here, in this browser. The round Hidden videos button at the top of this page opens the Hidden videos page, a wall of everything you hid.']);
    s.append(el('h3', '', 'The Hidden videos page'),
      note('Click the round Hidden videos button above. Every hidden video shows up as a wall, newest first. Point at a video and press a key:'));
    s.append(row(
      card(['X'], 'Bring one back', 'Press X: the video turns red. Press X again within a few seconds and it leaves this page and shows up in your feed and searches again. Esc, or moving away, cancels.'),
      card(['Ctrl', 'Shift', 'X'], 'Bring them all back', 'Press it twice anywhere on the page. The whole wall turns red and a note asks you to confirm; Esc cancels.'),
      card(['A'], 'Save the video', 'Adds it to your active playlist while you are looking at it, like on any wall. A click plays or opens it the same way too.')));
    s.append(el('h3', '', 'Good to know'),
      el('p', '', 'Hidden videos are saved in this browser and survive restarts. Hiding is separate from History and from following: a hidden video can be in History, and hiding a creator’s video never unfollows the creator. Use it for lessons you have finished, videos you are tired of seeing, or anything you never want to run into again.'));
    return s;
  }

  function history() {
    var s = box('pt-guide-history', 60, ICONS.history, 'History', [
      'History is the list of videos you have watched, newest first. Open it with the book button in the top bar. It loads in pages as you scroll, so a long history opens quickly. It is kept inside this app, and it is separate from hiding: a hidden video can be in History, and a video in History is not hidden.']);
    s.append(el('h3', '', 'Taking things out'),
      note('Point at a video on the History page and press a key:'));
    s.append(row(
      card(['X'], 'Remove one video', 'Press X twice. The video leaves your watch history, so it counts as not watched again, and it disappears from the page right away.'),
      card(['Ctrl', 'Shift', 'X'], 'Clear all watch history', 'Press it twice, away from the term bar. A notice asks you to confirm; Esc cancels.')));
    s.append(el('p', '', 'There is no clear-history button; the keys above are the way. The History button in the top bar stays either way.'));
    s.append(el('h3', '', 'Pausing it'),
      el('p', '', 'The round Watch history switch at the top of this page turns recording off: while it is off, videos you watch are not added to History. What is already there stays, and you can still remove it with X.'));
    return s;
  }

  function build() {
    var page = document.querySelector('main.pt-account-page');
    if (!page) { if ((build.tries = (build.tries || 0) + 1) < 60) setTimeout(build, 100); return; }
    if (page.querySelector('#pt-guide-favorites')) return;
    [favorites, videos, feed, groups, following, hidden, history].forEach(function (make) {
      var s = make(); s.classList.add('pt-guide-built'); place(page, s);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
}());
