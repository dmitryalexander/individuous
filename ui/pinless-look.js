/*! pinless-look-build:2026-10-15-menuboxes1 */
/* Pinless look for Invidious (the YouTube app in MyApps).
   - Header like Pinless: brand + pill search with the red icon; S (search terms), F (Subscriptions)
     and M (Menu) circles on the right, like the other apps. Search filters are a funnel circle.
   - Video tiles show only the thumbnail. Hover zones work like Pinless and the Lens Wall extension:
       top 0-10%   red    opens downloader / Ctrl-click transcript
       10-20%      blue   opens the video page         (label shows the title)
       20-100%     gray   plays/pauses in place         (label shows the title)
   - Brick wall like Pinless: equal columns, each tile placed in the shortest one. Every tile takes
     its video's real shape, so Shorts are tall 9:16 bricks beside 16:9 videos (square stays square).
   - Resting the mouse on the gray zone plays a silent preview in the tile (Menu > Hover previews).
   - Watch page: player and details card, related videos as a full-width wall; Shorts get a tall player.
   - Picks up new builds by itself (Invidious tells browsers to cache this file for a month).
   Replaces the old "quiet" YouTube layer. Links and forms keep working if this script fails. */
;(() => {
  'use strict';
  const BUILD = '2026-10-15-menuboxes1';
  // The search group dropdown (interest-bar.js) reuses the playlist picker.
  window.ptMenuPicker = (label, opts) => playlistPicker(label, !!opts.here, opts);
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => [...(root || document).querySelectorAll(selector)];
  const SEARCH_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';
  const FILTER_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 5h18l-9 15Z"/></svg>';
  const textOf = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');


  const icon = paths => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + paths + '</svg>';
  const STAR_ICON = icon('<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>');
  /* Playlist picker: click the playlist name next to the star (top left, every page, the Playlists
     page included) to choose which playlist A saves to. Arrow keys move, Enter picks, Escape closes.
     In the open menu, point at (or focus) a playlist and press A for a new playlist, R to rename it,
     or X twice to delete it. The last playlist can't be deleted, so one is always active.
     A while pointing at the closed name also starts a new playlist. */
  let pickerMove = null; // Playlists page: set while a video is picked up to move (listControls)
  function playlistPicker(label, here, opts = {}) {
    const locked = id => id === window.ptAggregateGroups.ID || !!opts.locked?.(id);
    const lockedName = opts.lockedName || 'All Groups';
    // opts (search groups): read, save, refresh, select, blank, noun, nouns, menuLabel. Defaults are the playlists.
    const R = opts.read || readLists, F = opts.refresh || refreshLists, P = opts.select || pickPlaylist;
    const W = opts.save ? (data => { if (opts.save(data) === false) throw new Error('Could not save'); }) : saveLists;
    const NOUN = opts.noun || 'playlist', NOUNS = opts.nouns || 'playlists', MENU = opts.menuLabel || 'Save to playlist';
    const blank = opts.blank || (() => ({items: []}));
    const mover = () => opts.read ? null : pickerMove;
    if (!label || label.dataset.picker) return;
    if (here) label.classList.add('pt-playlist-here');
    label.dataset.picker = '1';
    label.setAttribute('role', 'button'); label.tabIndex = 0;
    label.setAttribute('aria-haspopup', 'menu'); label.setAttribute('aria-expanded', 'false');
    const menu = document.createElement('div');
    menu.className = 'pt-playlist-picker'; if (opts.menuClass) menu.classList.add(opts.menuClass); menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', MENU); menu.hidden = true;
    const hint = document.createElement('p'); hint.className = 'pt-picker-hint'; hint.setAttribute('role', 'status');
    document.body.append(menu);
    const HINT = '', EDIT_HINT = '', MOVE_HINT = 'Pick a playlist to move the video to';
    let hovered = null, inMenu = false, overLabel = false, movedSinceOpen = false, armed = null, armTimer = 0, noteTimer = 0, editing = null;
    const items = () => [...menu.querySelectorAll('button[data-list-id]')];
    const baseHint = () => editing ? EDIT_HINT : mover() ? MOVE_HINT : HINT;
    function showHint(text, warn) {
      clearTimeout(noteTimer); hint.textContent = text || baseHint(); hint.classList.toggle('pt-picker-warn', !!warn);
      if (warn) noteTimer = setTimeout(() => showHint(), 2600);
    }
    function disarm() {
      clearTimeout(armTimer);
      if (!armed) return;
      armed.classList.remove('pt-list-delete-armed'); armed = null; showHint();
    }
    function close(focusLabel, quiet) {
      if (menu.hidden) return;
      menu.hidden = true; label.setAttribute('aria-expanded', 'false');
      clearTimeout(armTimer); armed = null; editing = null; hovered = null; inMenu = false;
      removeEventListener('keydown', keys, true);
      if (!quiet) label.dispatchEvent(new CustomEvent('pt-picker-close'));
      if (focusLabel) label.focus({preventScroll: true});
    }
    function render(focusId) {
      let data; try { data = R(); } catch (_) { return false; }
      clearTimeout(armTimer); armed = null; editing = null; hovered = null;
      menu.classList.toggle('pt-move-targets', !!mover());
      menu.setAttribute('aria-label', mover() ? 'Move video to playlist' : MENU);
      menu.replaceChildren(...data.lists.map(list => {
        const item = document.createElement('button'); item.type = 'button'; item.dataset.listId = list.id;
        item.setAttribute('role', 'menuitemradio'); item.setAttribute('aria-checked', String(list.id === data.activeId));
        const name = document.createElement('span'); name.className = 'pt-picker-name'; name.textContent = list.name;
        item.append(name); item.title = list.name;
        item.addEventListener('click', event => {
          event.stopPropagation();
          if (mover()) { if (locked(list.id)) { showHint('Choose a named playlist as the destination.',true); return; } mover().move(list.id); close(true); return; }
          close(true);
          if (list.id !== data.activeId) P(list.id);
        });
        return item;
      }), hint);
      showHint();
      const focus = (focusId && items().find(item => item.dataset.listId === focusId)) || menu.querySelector('[aria-checked="true"]') || items()[0];
      focus?.focus({preventScroll: true}); focus?.scrollIntoView({block: 'nearest'});
      return true;
    }
    function position() {
      const box = label.getBoundingClientRect();
      menu.style.top = Math.round(box.bottom + 6) + 'px';
      menu.style.left = Math.round(Math.max(8, Math.min(box.left, innerWidth - menu.offsetWidth - 8))) + 'px';
    }
    function open() {
      if (!menu.hidden) { render(); return; }
      menu.hidden = false;
      if (!render()) { menu.hidden = true; return; }
      label.setAttribute('aria-expanded', 'true'); movedSinceOpen = false;
      position();
      addEventListener('keydown', keys, true);
    }
    function startEdit(list) {
      if (list && locked(list.id)) { showHint(lockedName + ' is always kept. Use A to create a named group.', true); return; }
      if (menu.hidden) open();
      if (editing) render();
      disarm();
      const row = document.createElement('div'); row.className = 'pt-picker-edit';
      const input = document.createElement('input'); input.maxLength = 80; input.autocomplete = 'off'; input.spellcheck = false;
      input.placeholder = list ? 'Rename ' + NOUN : 'New ' + NOUN + ' name'; input.setAttribute('aria-label', input.placeholder);
      input.value = list ? list.name : '';
      row.append(input);
      const at = list && items().find(item => item.dataset.listId === list.id);
      if (at) at.replaceWith(row); else menu.insertBefore(row, hint);
      editing = {id: list ? list.id : null, input};
      showHint();
      input.focus({preventScroll: true}); input.select(); row.scrollIntoView({block: 'nearest'});
      // Clicking elsewhere in the menu abandons the edit.
      input.addEventListener('blur', () => setTimeout(() => { if (editing && editing.input === input && !menu.hidden && document.activeElement !== input) render(editing.id); }, 0));
    }
    function commitEdit() {
      const {id, input} = editing, name = input.value.replace(/\s+/g, ' ').trim();
      if (!name) { input.focus(); return; }
      try {
        const data = R();
        if (data.lists.some(list => list.id !== id && list.name.toLowerCase() === name.toLowerCase())) { showHint('A ' + NOUN + ' with that name already exists.', true); return; }
        let focusId = id;
        if (id) { const list = data.lists.find(list => list.id === id); if (!list) throw new Error('Playlist unavailable'); list.name = name; }
        else { focusId = crypto.randomUUID(); data.lists.push({id: focusId, name, ...blank()}); data.activeId = focusId; }
        W(data); render(focusId); F();
      } catch (_) { showHint('Could not save. Check browser storage and try again.', true); }
    }
    function remove(item) {
      const id = item.dataset.listId;
      let data; try { data = R(); } catch (_) { showHint('Could not read ' + NOUNS + '. Check browser storage.', true); return; }
      const index = data.lists.findIndex(list => list.id === id);
      if (index < 0) { render(); return; }
      if (locked(id)) { disarm(); showHint(lockedName + ' can’t be deleted.', true); return; }
      if (data.lists.length < 2) { disarm(); showHint('The last ' + NOUN + ' can’t be deleted.', true); return; }
      if (armed !== item) {
        disarm(); armed = item; item.classList.add('pt-list-delete-armed');
        showHint('Press X again to delete “' + data.lists[index].name + '”', true);
        clearTimeout(noteTimer); armTimer = setTimeout(disarm, 4000); return;
      }
      data.lists.splice(index, 1);
      const next = data.lists[Math.min(index, data.lists.length - 1)].id;
      if (data.activeId === id) data.activeId = next;
      try { W(data); } catch (_) { disarm(); showHint('Could not delete. Check browser storage and try again.', true); return; }
      render(next); F();
    }
    // While open, the menu owns the keyboard so page shortcuts (A, S, X...) never fire behind it,
    // unless the pointer has moved off to the page: then the key goes to whatever it points at.
    function keys(event) {
      if (editing && document.activeElement === editing.input) {
        if (event.key === 'Enter') { event.preventDefault(); commitEdit(); }
        else if (event.key === 'Escape') { event.preventDefault(); render(editing.id); }
        event.stopPropagation(); event.stopImmediatePropagation(); return;
      }
      const key = event.key.toLowerCase(), list = items(), at = list.indexOf(document.activeElement);
      const letter = /^[a-z]$/.test(key);
      if (letter && movedSinceOpen && !inMenu && !overLabel) { close(false, true); return; }
      const plain = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && !event.isComposing && !event.repeat;
      const target = (inMenu && hovered && hovered.isConnected) ? hovered : (at >= 0 ? list[at] : null);
      if (event.key === 'Escape') { event.preventDefault(); if (armed) disarm(); else close(true); }
      else if (event.key === 'Tab') close(false);
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault(); disarm();
        list[(at + (event.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
      } else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); disarm(); list[event.key === 'Home' ? 0 : list.length - 1]?.focus(); }
      else if (plain && key === 'a' && !mover()) { event.preventDefault(); startEdit(null); }
      else if (plain && key === 'r' && target && !mover()) {
        event.preventDefault();
        try { startEdit(R().lists.find(item => item.id === target.dataset.listId)); } catch (_) {}
      }
      else if (plain && key === 'x' && target && !mover()) { event.preventDefault(); remove(target); }
      else if (key !== 'x') disarm();
      event.stopPropagation(); event.stopImmediatePropagation();
    }
    menu.addEventListener('pointermove', event => {
      inMenu = true;
      const item = event.target.closest('button[data-list-id]');
      if (item !== hovered) { if (armed && item !== armed) disarm(); hovered = item; }
    }, {passive: true});
    menu.addEventListener('pointerleave', () => { inMenu = false; hovered = null; disarm(); });
    label.addEventListener('pointerenter', () => { overLabel = true; });
    label.addEventListener('pointerleave', () => { overLabel = false; });
    document.addEventListener('pointermove', () => { if (!menu.hidden) movedSinceOpen = true; }, {passive: true});
    label.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); menu.hidden ? open() : close(true); });
    label.addEventListener('keydown', event => {
      if (!['Enter', ' ', 'ArrowDown'].includes(event.key) || event.ctrlKey || event.altKey || event.metaKey) return;
      event.preventDefault(); event.stopPropagation(); open();
    });
    // A while pointing at the closed playlist name: new playlist.
    addEventListener('keydown', event => {
      if (!menu.hidden || !overLabel || event.key.toLowerCase() !== 'a' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.isComposing) return;
      if (event.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])') || document.querySelector('dialog[open]')) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      startEdit(null);
    }, true);
    label.addEventListener('pt-picker-open', () => open());
    label.addEventListener('pt-picker-hide', () => close(false, true));
    document.addEventListener('pointerdown', event => { if (!menu.hidden && !menu.contains(event.target) && !label.contains(event.target)) close(false); }, true);
    addEventListener('resize', () => close(false));
    // The header stays on screen, so scrolling the page only moves the menu with its name.
    addEventListener('scroll', () => { if (menu.hidden) return; if (label.getBoundingClientRect().bottom < 0) close(false); else position(); }, {passive: true});
    addEventListener('blur', () => close(false));
  }
  function headerIcons() {
    const items = [
      ['.pt-brand', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m9 6 9 6-9 6Z"/></svg>', 'Subscriptions Feed'],
      ['.pt-follow', icon('<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>'), 'Subscriptions'],
      ['.pt-history', icon('<path d="M12 5v16M12 5C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 1Z"/>'), 'Watch History'],
      ['.pt-menu > summary', icon('<path d="M4 6h16M4 12h16M4 18h16"/>'), 'Menu']
    ];
    items.forEach(([selector, svg, name]) => { const el=$(selector); if(el){el.innerHTML=svg;el.title=name;el.setAttribute('aria-label',name);} });
    const searchButton=$('.pt-search button[type=submit]'); if(searchButton) searchButton.innerHTML=SEARCH_ICON;
    const nav=$('.pt-nav');
    if(nav && !$('.pt-star-link')) {
      const link=document.createElement('a');link.className='pt-circle pt-star-link';link.href='/star.html';link.innerHTML=STAR_ICON;link.title='Playlists';link.setAttribute('aria-label','Playlists');
      if(location.pathname==='/star.html')link.setAttribute('aria-current','page');
      nav.prepend(link);
    }
    const star=$('.pt-star-link');
    if(star && !$('.pt-active-playlist')) {
      const label=document.createElement('span');label.className='pt-active-playlist';star.after(label);
      playlistPicker(label, location.pathname==='/star.html');
      updateActivePlaylist();
      window.addEventListener('storage',event=>{if(event.key===LISTS_KEY||event.key===null)updateActivePlaylist();});
    }
    if(star && !star.closest('.pt-favorites')) {
      const favorites=document.createElement('div');favorites.className='pt-favorites';
      favorites.append(star,$('.pt-active-playlist'));$('.pt-header').prepend(favorites);
    }
  }
  const STARS_KEY = 'pt-starred-videos-v1';
  const LISTS_KEY = 'pt-video-lists-v1';
  function readLists() {
    const raw = localStorage.getItem(LISTS_KEY);
    if (raw !== null) {
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.lists) || !data.lists.length || !data.lists.some(list => list.id === data.activeId) ||
          !data.lists.every(list => typeof list.id === 'string' && typeof list.name === 'string' && Array.isArray(list.items) && list.items.every(validSavedVideo))) throw new Error('Invalid saved lists');
      if (!localStorage.getItem('pt-watch-later-default-v1')) {
        let later=data.lists.find(list=>list.name.toLowerCase()==='watch later');
        if(!later){later={id:crypto.randomUUID(),name:'Watch Later',items:[]};data.lists.push(later);}
        data.activeId=later.id;localStorage.setItem(LISTS_KEY,JSON.stringify(data));
        localStorage.setItem('pt-watch-later-default-v1','1');
      }
      return window.ptAggregateGroups.combine(data,'items');
    }
    const old = JSON.parse(localStorage.getItem(STARS_KEY) || '[]');
    if (!Array.isArray(old)) throw new Error('Invalid saved favorites');
    const data = {activeId:'watch-later', lists:[{id:'watch-later',name:'Watch Later',items:[]},{id:'favorites', name:'Favorites', items:old.filter(validSavedVideo)}]};
    // Keep the original stars as a backup; migration only runs before lists exist.
    localStorage.setItem(LISTS_KEY, JSON.stringify(data));
    localStorage.setItem('pt-watch-later-default-v1','1');
    return window.ptAggregateGroups.combine(data,'items');
  }
  function validSavedVideo(item) { return item && /^[\w-]{11}$/.test(item.id) && typeof item.title === 'string'; }
  function updateActivePlaylist(data) {
    const label=$('.pt-active-playlist');if(!label)return;
    try{data=data||readLists();const name=data.lists.find(list=>list.id===data.activeId).name;label.textContent=name;label.title=(data.activeId === window.ptAggregateGroups.ID ? 'Viewing All Groups · choose a named playlist to save or edit videos' : 'Saving to '+name)+' · click to change · A for a new playlist';label.setAttribute('aria-label',label.title);}catch(_){label.textContent='Playlist unavailable';}
  }
  function chooseNamedPlaylist() {
    const label = $('.pt-active-playlist'); label?.dispatchEvent(new CustomEvent('pt-picker-open'));
    const hint = $('.pt-playlist-picker:not([hidden]) .pt-picker-hint');
    if (hint) hint.textContent = 'All Groups combines your playlists. Choose a named playlist to save, move or remove videos.';
  }
  function pickPlaylist(id) {
    try { const data=readLists(); if(!data.lists.some(list=>list.id===id)) return; data.activeId=id; saveLists(data); renderListOptions(data); refreshLists(); }
    catch (_) { const label=$('.pt-active-playlist'); if(label) label.textContent='Playlist unavailable'; }
  }
  function saveLists(data) { localStorage.setItem(LISTS_KEY, JSON.stringify(window.ptAggregateGroups.persist(data,'items'))); updateActivePlaylist(data); }
  function updateListBorders(data) {
    try { data=window.ptAggregateGroups.combine(data||readLists(),'items'); } catch (_) { return; }
    const saved=new Set(data.lists.find(list=>list.id===data.activeId).items.map(item=>item.id));
    const anySaved=new Set(data.lists.flatMap(list=>list.items.map(item=>item.id)));
    $$('.pt-video').forEach(card=>{const id=$('.pt-thumb',card)?.dataset.ptId;card.classList.toggle('pt-in-active-list',saved.has(id));card.classList.toggle('pt-in-any-list',anySaved.has(id));});
  }
  let listRefreshTimer;
  function refreshLists() { clearTimeout(listRefreshTimer); if ($('#pt-star-wall')) { stopPreview(); renderStars(); scanWalls(); } else updateListBorders(); }
  function listControls() {
    const select = $('#pt-active-list'), wall = $('#pt-star-wall');
    if (!select || !wall) return;
    // Playlists are switched, added, renamed and deleted in the dropdown by the star (playlistPicker);
    // the middle of the header holds the usual search term chips.
    let pointer=null;
    document.addEventListener('pointermove',event=>{pointer={x:event.clientX,y:event.clientY};},{passive:true});
    document.addEventListener('pointerleave',()=>{pointer=null;});
    window.addEventListener('blur',()=>{pointer=null;});
    const label=$('.pt-active-playlist');
    const typing=event=>event.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role=textbox]')||$('dialog[open]');
    const pointed=()=>pointer?document.elementFromPoint(pointer.x,pointer.y):document.activeElement;
    let moving = null;
    function cancelMove() {
      $$('.pt-move-selected').forEach(node=>node.classList.remove('pt-move-selected'));
      moving=null; pickerMove=null;
    }
    function moveTo(destinationId) {
      const pending=moving; if(!pending)return;
      if(destinationId===pending.sourceId){cancelMove();return;}
      try{
        const data=readLists(),source=data.lists.find(list=>list.id===pending.sourceId),destination=data.lists.find(list=>list.id===destinationId);
        if (source?.id === window.ptAggregateGroups.ID || destination?.id === window.ptAggregateGroups.ID) { cancelMove(); return; }
        const item=source?.items.find(item=>item.id===pending.id);
        if(!item||!destination){cancelMove();return;}
        if(!destination.items.some(video=>video.id===item.id))destination.items.unshift(item);
        source.items=source.items.filter(video=>video.id!==item.id);
        saveLists(data);cancelMove();refreshLists();
      }catch(_){cancelMove();$('#pt-star-note').textContent='Could not move the video. Check browser storage and try again.';}
    }
    window.addEventListener('storage',cancelMove);
    label?.addEventListener('pt-picker-close',cancelMove);
    // A on a saved video picks it up and opens the playlist menu; pick a playlist to move it there.
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'){cancelMove();return;}
      if(event.key.toLowerCase()!=='a'||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||event.isComposing)return;
      if(typing(event))return;
      const card=pointed()?.closest('#pt-star-wall .pt-video');
      const id=card && $('.pt-thumb',card)?.dataset.ptId;
      if(!id)return;
      event.preventDefault();event.stopImmediatePropagation();
      if(moving?.id===id){cancelMove();label?.dispatchEvent(new CustomEvent('pt-picker-hide'));return;}
      try {
        const data=readLists();cancelMove();if(data.activeId === window.ptAggregateGroups.ID){chooseNamedPlaylist();return;}moving={id,sourceId:data.activeId};
        card.classList.add('pt-move-selected');pickerMove={move:moveTo};
        label?.dispatchEvent(new CustomEvent('pt-picker-open'));
      }catch(_){$('#pt-star-note').textContent='Could not select this video. Check browser storage and try again.';}
    },true);
    // S over the page (not the header) shuffles the videos in the active playlist.
    document.addEventListener('keydown',event=>{
      if(event.key.toLowerCase()!=='s'||event.defaultPrevented||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||event.isComposing)return;
      if(typing(event))return;
      if(pointed()?.closest('.pt-header,.pt-playlist-picker'))return;
      event.preventDefault();
      try {
        const data=readLists(),items=data.lists.find(list=>list.id===data.activeId).items;
        if(data.activeId === window.ptAggregateGroups.ID){$('#pt-star-note').textContent='Choose a named playlist to shuffle and save its order.';return;}
        if(items.length<2)return;
        const previous=[...items];
        for(let i=items.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[items[i],items[j]]=[items[j],items[i]];}
        if(items.every((item,i)=>item===previous[i]))items.push(items.shift());
        saveLists(data);refreshLists();
      }catch(_){$('#pt-star-note').textContent='Could not update the list. Check browser storage and try again.';}
    });
    // X twice over a video removes it from the active playlist.
    let armed=null, deleteTimer;
    function cancelDelete(){clearTimeout(deleteTimer);armed?.node.classList.remove('pt-list-delete-armed');armed=null;}
    const deletionTarget=target=>target?.closest('#pt-star-wall .pt-video');
    document.addEventListener('pointermove',event=>{if(armed&&deletionTarget(event.target)!==armed.node)cancelDelete();},{passive:true});
    document.addEventListener('pointerleave',cancelDelete);
    document.addEventListener('click',cancelDelete,true);
    window.addEventListener('blur',cancelDelete);
    window.addEventListener('storage',cancelDelete);
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'){cancelDelete();return;}
      if(event.key.toLowerCase()!=='x'){cancelDelete();return;}
      if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||event.isComposing)return;
      if(typing(event))return;
      const node=deletionTarget(pointed());
      if(!node){cancelDelete();return;}
      event.preventDefault();event.stopImmediatePropagation();
      try{
        const data=readLists(), videoId=$('.pt-thumb',node)?.dataset.ptId, key='video:'+data.activeId+':'+videoId;
        if(data.activeId === window.ptAggregateGroups.ID){cancelDelete();chooseNamedPlaylist();return;}
        if(!armed||armed.node!==node||armed.key!==key){cancelDelete();armed={node,key};node.classList.add('pt-list-delete-armed');deleteTimer=setTimeout(cancelDelete,4000);return;}
        const list=data.lists.find(list=>list.id===data.activeId);
        list.items=list.items.filter(item=>item.id!==videoId);
        saveLists(data);cancelDelete();refreshLists();
      }catch(_){cancelDelete();$('#pt-star-note').textContent='Could not delete. Check browser storage and try again.';}
    },true);
    select.addEventListener('change', () => {
      try { const data=readLists(); if(!data.lists.some(list=>list.id===select.value)) return; data.activeId=select.value; saveLists(data); refreshLists(); }
      catch (_) { $('#pt-star-note').textContent='Could not change the active list. Check browser storage and try again.'; renderListOptions(); }
    });
  }
  function renderListOptions(data) {
    const select=$('#pt-active-list');if(!select)return;
    try { data=data||readLists(); } catch (_) { return; }
    select.replaceChildren(...data.lists.map(list=>{const option=document.createElement('option');option.value=list.id;option.textContent=list.name+' ('+list.items.length+')';return option;}));
    select.value=data.activeId;
  }
  function listHotkey() {
    if ($('#pt-star-wall')) return;
    let hovered=null;
    document.addEventListener('pointerover', event=>{hovered=event.target.closest('.pt-video .pt-thumb');});
    document.addEventListener('pointerout', event=>{if(hovered && !hovered.contains(event.relatedTarget))hovered=null;});
    addEventListener('blur',()=>{hovered=null;});
    document.addEventListener('keydown', event=>{
      if(event.key.toLowerCase()!=='a'||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||event.isComposing) return;
      if(event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')||document.querySelector('dialog[open]'))return;
      const thumb=(hovered?.isConnected && hovered)||document.activeElement?.closest('.pt-video .pt-thumb');
      if(!thumb || thumb.closest('[hidden]'))return;
      const id=thumb.dataset.ptId;if(!id)return;
      event.preventDefault();
      const status=$('.pt-status',thumb);
      try {
        const data=readLists(),list=data.lists.find(list=>list.id===data.activeId),saved=list.items.some(item=>item.id===id);
        if(data.activeId === window.ptAggregateGroups.ID){chooseNamedPlaylist();return;}
        list.items=saved?list.items.filter(item=>item.id!==id):[{id,title:textOf($('.pt-label-title',thumb))||$('img',thumb)?.alt||id},...list.items];
        saveLists(data);
        // Restart feedback for every deliberate press, including a quick undo.
        $('.pt-list-flash',thumb)?.remove();
        const flash=document.createElement('span');flash.className='pt-list-flash '+(saved?'pt-list-removed':'pt-list-added');flash.setAttribute('aria-hidden','true');thumb.append(flash);
        flash.addEventListener('animationend',()=>flash.remove(),{once:true});
        status.hidden=true;
        updateListBorders(data);
        renderListOptions(data);
        if($('#pt-star-wall')) { clearTimeout(listRefreshTimer);listRefreshTimer=setTimeout(refreshLists,240); }
      } catch (_) {status.hidden=false;status.textContent='Could not update the list. Check browser storage and try again.';}
    });
  }
  function renderStars() {
    const wall=$('#pt-star-wall');if(!wall)return;
    const note=$('#pt-star-note');
    let data;try{data=readLists();}catch(_){window.ptEmptyGuide?.show('playlists',false);note.textContent='Could not read saved lists. Check browser storage and reload.';return;}
    renderListOptions(data);
    const list=data.lists.find(list=>list.id===data.activeId);
    wall.replaceChildren();
    note.textContent=data.activeId === window.ptAggregateGroups.ID ? 'All Groups combines every playlist, showing each video once. Choose a named playlist to save, move or remove videos.' : list.items.length?'':'This list is empty. Hover a video anywhere and press A to add it to '+list.name+'.';
    list.items.forEach(item=>{
      const card=document.createElement('div');card.className='pure-u-1 pure-u-md-1-4';
      const box=document.createElement('div');box.className='h-box';
      const thumb=document.createElement('div');thumb.className='thumbnail';
      const link=document.createElement('a');link.href='/watch?v='+item.id;
      const img=document.createElement('img');img.className='thumbnail';img.alt=item.title;img.src='/vi/'+item.id+'/mqdefault.jpg';
      link.append(img);thumb.append(link);box.append(thumb);card.append(box);wall.append(card);
    });
    window.ptEmptyGuide?.show('playlists', list.items.length === 0);
  }
  addEventListener('storage',event=>{if(event.key===LISTS_KEY||event.key===null)refreshLists();});

  /* ---------- New builds: fetch fresh copies of the cached CSS/JS once, then reload ---------- */
  function checkForNewBuild() {
    const script = $('script[src*="/js/handlers.js"]');
    if (!script || !window.fetch) return;
    const sheet = $('link[rel="stylesheet"][href*="/css/default.css"]');
    const urls = [script.src, sheet && sheet.href].filter(Boolean);
    const refresh = key => {
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, '1');
      } catch (_) { return; } // no storage: never risk a reload loop
      Promise.all(urls.map(url => fetch(url, { cache: 'reload', credentials: 'same-origin' })))
        .then(() => {
          const video = $('video');
          if (video && !video.paused) return; // never interrupt playback; the next page load picks it up
          location.reload();
        })
        .catch(() => {});
    };
    // The stylesheet may be older than this script (each file is cached separately).
    const cssBuild = getComputedStyle(document.documentElement).getPropertyValue('--pinless-look-build').replace(/["'\s]/g, '');
    if (cssBuild !== BUILD) { refresh('pinless-look-css:' + BUILD); return; }
    const mark = new RegExp('pinless-look-' + 'build:([\\w.-]+)');
    fetch(script.src, { cache: 'no-cache', credentials: 'same-origin' })
      .then(response => (response.ok ? response.text() : ''))
      .then(text => {
        const latest = (text.match(mark) || [])[1];
        if (latest && latest !== BUILD) refresh('pinless-look-js:' + latest);
      })
      .catch(() => {});
  }

  /* ---------- Header and menu ---------- */
  function menuLink(text, href) {
    const a = document.createElement('a');
    a.className = 'pt-menu-item';
    a.href = href;
    a.textContent = text;
    return a;
  }

  function buildHeader() {
    const header = $('.navbar');
    if (!header) return false;
    if (['discover', 'hidden', 'youtube'].includes(new URLSearchParams(location.search).get('pt_page'))) {
      if (!$('.index-link', header)) {
        const home = document.createElement('a'); home.className = 'index-link'; home.href = '/'; home.textContent = 'individuous'; header.prepend(home);
      }
      const search = $('form[action="/search"]');
      if (search && !header.contains(search)) header.append(search);
    }
    const brand = $('.index-link', header);
    const form = $('form[action="/search"]', header);
    if (!brand || !form) return false;
    const links = [];
    let login = null, logout = null, signedIn = false, unseen = 0, nick = '';
    $$('.user-field > div', header).forEach(cell => {
      // Log out is a POST form with a CSRF token: move the whole form, never just its link.
      const signout = $('form[action^="/signout"]', cell);
      if (signout) {
        signedIn = true;
        const submit = $('input[type="submit"]', signout);
        if (submit) {
          const wrapper = submit.closest('a');
          if (wrapper && signout.contains(wrapper)) wrapper.replaceWith(submit);
          submit.removeAttribute('style');
          submit.className = 'pt-menu-item';
        }
        signout.classList.add('pt-menu-form');
        logout = signout;
        return;
      }
      const ticker = $('#notification_ticker', cell);
      if (ticker) {
        signedIn = true;
        unseen = parseInt(textOf($('#notification_count', ticker)), 10) || 0;
        return;
      }
      const name = $('#user_name', cell);
      if (name) { nick = textOf(name); return; }
      const a = $('a[href]', cell);
      if (!a) return;
      if (a.id === 'toggle_theme') {
        // themes.js updates its first child when preferences load or change.
        const icon = a.firstElementChild || document.createElement('i');
        a.replaceChildren(icon, document.createTextNode(' Theme'));
      } else a.textContent = (a.title || a.textContent).trim();
      a.className = 'pt-menu-item';
      if (a.getAttribute('href').startsWith('/login')) login = a;
      else links.push(a);
    });

    const panel = document.createElement('div');
    panel.className = 'quiet-menu-panel';
    if (nick) {
      const who = document.createElement('div');
      who.className = 'pt-menu-note';
      who.textContent = nick;
      panel.append(who);
    }
    panel.append(...links);
    if (signedIn) {
      panel.append(menuLink('Watch history', '/feed/history'), menuLink('Manage subscriptions', '/subscription_manager'));
      const rss = $('#contents a[href^="/feed/private"]');
      if (rss) panel.append(menuLink('RSS feed', rss.getAttribute('href')));
    }
    const listed = new Set(['/feed/subscriptions']);
    $$('.feed-menu a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (listed.has(href) || !textOf(a)) return;
      listed.add(href);
      panel.append(menuLink(textOf(a), href));
    });
    panel.append(previewSwitch());
    // One user, always signed in (the gateway signs in automatically): no Log in / Log out items.

    const menu = document.createElement('details');
    menu.className = 'quiet-menu pt-menu';
    const summary = document.createElement('summary');
    summary.textContent = 'M';
    summary.setAttribute('aria-label', 'Menu');
    summary.title = 'Menu';
    menu.append(summary, panel);
    // F, like Following in the Instagram and Tumblr apps: the channels you subscribe to.
    // (The interest bar adds S, the search terms editor, to its left.)
    const follow = document.createElement('a');
    follow.className = 'pt-circle pt-follow';
    follow.textContent = 'F';
    follow.href = '/subscription_manager';
    follow.title = 'Subscriptions';
    follow.setAttribute('aria-label', follow.title);
    const nav = document.createElement('div');
    nav.className = 'quiet-nav pt-nav';
    const history = document.createElement('a');
    history.className = 'pt-circle pt-history'; history.textContent = 'H';
    history.href = '/feed/history'; history.title = 'Watch history';
    history.setAttribute('aria-label', 'Watch history');
    nav.append(follow, history, menu);

    brand.className = 'quiet-brand pt-brand';
    brand.textContent = 'I';
    brand.href = '/feed/subscriptions';
    brand.title = 'individuous home';
    brand.setAttribute('aria-label', 'individuous home');
    form.className = 'quiet-search pt-search';
    const input = $('input[name="q"]', form);
    if (input) {
      input.placeholder = 'Search';
      input.setAttribute('aria-label', 'Search individuous');
    }
    const button = $('#searchbutton, button[type="submit"]', form);
    if (button) {
      button.innerHTML = SEARCH_ICON;
      button.setAttribute('aria-label', 'Search');
    }
    header.className = 'quiet-header pt-header';
    header.replaceChildren(brand, form, nav);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.open) { menu.open = false; summary.focus(); }
    });
    document.addEventListener('click', event => {
      if (menu.open && !menu.contains(event.target)) menu.open = false;
    });
    return true;
  }

  /* ---------- Small page tidy-ups ---------- */
  function fold(node, label, extra) {
    if (!node || node.closest('.quiet-disclosure')) return null;
    const details = document.createElement('details');
    details.className = 'quiet-disclosure' + (extra ? ' ' + extra : '');
    const summary = document.createElement('summary');
    summary.textContent = label;
    node.before(details);
    details.append(summary, node);
    return details;
  }

  function tidyFilters() {
    $$('#filters-collapse, #filters').forEach(el=>el.remove());
  }

  function hide(element) {
    const contents = $('#contents');
    if (!element || !contents || element.contains(contents)) return;
    element.classList.add('pt-hidden');
  }

  function tidySubscriptions() {
    if (location.pathname !== '/feed/subscriptions') return;
    // "Manage subscriptions", "Watch history" and RSS are in the Menu now. The Menu has its own
    // "Manage subscriptions" link, so look for the page's row outside the header.
    const manage = $$('#contents a[href="/subscription_manager"]').find(a => !a.closest('.pt-header'));
    const row = manage && manage.closest('#contents .pure-g');
    if (row && !$('div.thumbnail', row)) hide(row);
    $$('#contents > center').forEach(note => {
      if (/^\s*0(\D|$)/.test(note.textContent)) hide(note);
      else note.classList.add('pt-note');
    });
  }

  /* ---------- Video tiles with hover zones ---------- */
  function videoId(href) {
    try { return new URL(href, location.href).searchParams.get('v'); } catch (_) { return null; }
  }

  function label(kind, text) {
    const span = document.createElement('span');
    span.className = 'pt-label ' + kind;
    span.setAttribute('aria-hidden', 'true');
    span.textContent = text;
    return span;
  }

  function makeTile(card, thumb) {
    if (!thumb || thumb.classList.contains('pt-thumb')) return false;
    const link = $('a[href^="/watch?"]', thumb);
    const id = link && videoId(link.getAttribute('href'));
    if (!id) return false;
    const title = textOf($('.video-card-row a[href^="/watch?"]', card)) || (($('img', link) || {}).alt || '').trim();
    const channelLink = $$('a[href^="/channel/"]', card).find(a => textOf(a));
    const channel = textOf(channelLink) || textOf($('.channel-name', card)) || textOf($('h5 b', card));
    const channelHref = channelLink ? channelLink.getAttribute('href')
      : channel ? '/search?q=' + encodeURIComponent(channel) + '&type=channel' : '';

    card.classList.add('pt-card', 'pt-video');
    thumb.classList.add('pt-thumb');
    thumb.dataset.ptId = id;
    thumb.addEventListener('click', event => {
      if (!event.ctrlKey || event.button !== 0 || event.target.closest('.pt-dl,.pt-ch')) return;
      event.preventDefault();
      event.stopPropagation();
      window.open('https://www.youtube.com/watch?v=' + encodeURIComponent(id), '_blank', 'noopener,noreferrer');
    }, true);
    thumb.dataset.ptChannel = channelHref.startsWith('/channel/') ? channelHref.split('/')[2] : '';
    thumb.dataset.ptChannelName = channel;
    const length = lengthOf(thumb);
    if (length) thumb.dataset.ptLength = String(length);
    const download = document.createElement('button');
    download.type = 'button';
    download.className = 'pt-zone pt-dl';
    download.title = 'Open downloader · Ctrl/⌘-click: transcript';
    download.setAttribute('aria-label', title ? 'Download or transcript: ' + title : 'Download or transcript');
    thumb.append(download);
    {
      const creator = document.createElement('a');
      creator.className = 'pt-zone pt-ch';
      creator.title = 'Open video · Ctrl-click: new tab';
      creator.href = link.getAttribute('href');
      creator.setAttribute('aria-label', title ? 'Open video: ' + title : 'Open video');
      thumb.append(creator);
    }
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'pt-zone pt-open';
    open.setAttribute('aria-label', title ? 'Play/pause: ' + title : 'Play/pause video');
    open.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (preview && preview.thumb === thumb && preview.manual) {
        if (preview.video.paused) preview.video.play().catch(() => playbackFailed(thumb));
        else preview.video.pause();
      } else startPreview(thumb, true);
    });
    thumb.append(open);
    if (title) thumb.append(label('pt-label-title', title));
    if (title) thumb.append(label('pt-label-channel', title));
    const status = document.createElement('span');
    status.className = 'pt-status';
    status.setAttribute('role', 'status');
    status.hidden = true;
    thumb.append(status);
    download.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      startDownload(id, title, download, status, event.ctrlKey || event.metaKey);
    });
    step(() => prepareShape(card, thumb));
    return true;
  }

  // Video length in seconds from the tile's duration badge (0 when there is none, e.g. LIVE).
  function lengthOf(thumb) {
    const text = textOf($('.length', thumb));
    if (!/^\d+(:\d\d){1,2}$/.test(text)) return 0;
    return text.split(':').reduce((total, part) => total * 60 + Number(part), 0);
  }

  // Playlist cards (a creator's Playlists tab, search results) are tiles like videos (October 15, 2026): the picture fills
  // the frame, the text rows under it are gone, and the title shows centered in a dark bar while you point at the tile.
  function makePlaylistTile(card, thumb) {
    const link = thumb && $('a[href^="/playlist?"]', thumb);
    if (!link || card.classList.contains('pt-playlist')) return;
    const title = textOf($('.video-card-row a[href^="/playlist?"]', card)) || textOf($('.video-card-row p', card));
    card.classList.add('pt-playlist');
    link.title = title ? 'Open playlist: ' + title : 'Open playlist';
    if (title) { link.setAttribute('aria-label', link.title); thumb.append(label('pt-label-title', title)); }
  }

  // Video cards on listing pages (feeds, search, channels, playlists, history).
  function tidyPlaylistHeading() {
    if (location.pathname !== '/playlist') return;
    const contents = $('#contents'), wall = contents && $('.pt-wall', contents);
    if (!wall) return; // Keep upstream error messages visible when there is no wall.
    const header = $('.pt-header');
    for (let branch = wall; branch && branch.parentElement && branch !== contents; branch = branch.parentElement) {
      for (const node of [...branch.parentElement.children]) {
        if (node === branch) break;
        if (node === header || (header && node.contains(header)) || node.matches('script,style,link')) continue;
        node.classList.add('pt-playlist-heading-hidden');
      }
    }
    wall.classList.add('pt-playlist-wall');
  }
  function scanWalls() {
    const walls = new Set();
    $$('#contents .pure-g > [class*="pure-u-"]').forEach(card => {
      if (card.closest('#playlist, .pt-watch-info, .pt-related, footer, .pt-header')) return;
      const thumb = $(':scope > .h-box > div.thumbnail', card);
      if (!thumb && !$(':scope > .h-box > a > center > img', card)) return;
      card.parentElement.classList.add('pt-wall');
      walls.add(card.parentElement);
      if (!makeTile(card, thumb) && !card.classList.contains('pt-card')) {
        card.classList.add('pt-card', 'pt-other');
        makePlaylistTile(card, thumb);
      }
    });
    tidyPlaylistHeading();
    updateListBorders();
    walls.forEach(brickWall);
    filterHiddenFeed();
    scheduleLayout();
    checkHiddenPage();
    if (location.pathname === '/feed/history') enhanceHistory();
  }

  // History supplies thumbnail IDs without titles, and fetched pages do not run handlers.js.
  const historyQueue = [];
  let historyActive = 0;
  const historyTitles = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    historyTitles.unobserve(entry.target);
    historyQueue.push(entry.target);
    pumpHistoryTitles();
  }), { rootMargin: '400px' });
  function pumpHistoryTitles() {
    while (historyActive < 3 && historyQueue.length) {
      const thumb = historyQueue.shift();
      historyActive++;
      fetch('/api/v1/videos/' + encodeURIComponent(thumb.dataset.ptId) + '?fields=title', { signal: AbortSignal.timeout(15000) })
        .then(response => response.ok ? response.json() : null)
        .then(data => {
          if (!data?.title) return;
          const title = $('.pt-label-title', thumb);
          if (title) title.textContent = data.title;
          else thumb.append(label('pt-label-title', data.title));
          $('.pt-open', thumb)?.setAttribute('aria-label', 'Play/pause: ' + data.title);
          $('.pt-ch', thumb)?.setAttribute('aria-label', 'Open video: ' + data.title);
          $('.pt-dl', thumb)?.setAttribute('aria-label', 'Download: ' + data.title);
        }).catch(() => {}).finally(() => { historyActive--; pumpHistoryTitles(); });
    }
  }
  function enhanceHistory() {
    $$('.pt-video').forEach(card => {
      const target = $('[data-onclick="mark_unwatched"]', card);
      if (target && !target.onclick && typeof window.mark_unwatched === 'function') {
        target.onclick = () => window.mark_unwatched(target);
        const form = target.closest('form');
        if (form) form.onsubmit = () => false;
      }
      const thumb = $('.pt-thumb', card);
      if (thumb && !thumb.dataset.ptHistoryTitle) {
        thumb.dataset.ptHistoryTitle = '1';
        if (!$('.pt-label-title', thumb)) historyTitles.observe(thumb);
      }
    });
  }

  function historyClearControls() {
    if (location.pathname !== '/feed/history') return;
    const link = $('a[href="/clear_watch_history"]');
    link?.closest('.pure-g')?.classList.add('pt-history-toolbar');
    let armed = false, busy = false;
    const notice = document.createElement('div');
    notice.className = 'pt-history-clear-notice';
    notice.setAttribute('role', 'status');
    notice.hidden = true;
    document.body.append(notice);
    function cancel() {
      armed = false;
      document.body.classList.remove('pt-history-clear-armed');
      if (!busy) notice.hidden = true;
    }
    addEventListener('blur', cancel);
    document.addEventListener('keydown', async event => {
      if (event.key === 'Escape') { cancel(); return; }
      if (!event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey || event.key.toLowerCase() !== 'x') return;
      if ($('.pt-interest-bar:hover')) return;
      if (event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])') || $('dialog[open]')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat || busy) return;
      if (!armed) {
        armed = true;
        document.body.classList.add('pt-history-clear-armed');
        notice.textContent = 'Clear all watch history? Press Ctrl+Shift+X again · Esc to cancel';
        notice.hidden = false;
        return;
      }
      busy = true;
      notice.textContent = 'Clearing watch historyâ€¦';
      try {
        // Obtain the dedicated token and submit the original account-wide form.
        const response = await fetch('/clear_watch_history?referer=%2Ffeed%2Fhistory', {credentials:'same-origin', cache:'no-store'});
        if (!response.ok) throw new Error('History confirmation unavailable');
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        const form = $('form[action^="/clear_watch_history"]', doc);
        const submit = $('button[name="submit"][value="clear_watch_history"]', form || doc);
        if (!form || !submit || !$('input[name="csrf_token"]', form)) throw new Error('History confirmation unavailable');
        form.hidden = true;
        document.body.append(form);
        form.requestSubmit(submit);
      } catch (_) {
        busy = false;
        cancel();
        notice.textContent = 'Could not clear watch history. Press Ctrl+Shift+X to try again.';
        notice.hidden = false;
      }
    }, true);
  }

  /* ---------- Video shapes: Shorts are tall ---------- */
  // YouTube's usual thumbnails are wide even for Shorts, but every video also has a first-frame
  // picture (/vi/ID/frame0.jpg, about 20 KB) in the video's real shape. The wall reads each video's
  // shape from that picture's header, tiles nearest the screen first and 3 at a time, instead of
  // calling YouTube's video API for every tile. Shorts also have a tall cover picture (oar2.jpg, the
  // one YouTube shows on its Shorts shelf). Answers are kept in this browser for about 3000 videos.
  const SHAPES_KEY = 'pt-shapes';
  const SHAPES_KEPT = 3000;
  const SHAPE_CHECKS = 3;
  const SHORTS_PAGE = /^\/(?:channel\/|c\/|user\/|@)[^/]+\/shorts\/?$/.test(location.pathname); // a channel's Shorts tab
  const pictureUrl = (id, name) => '/vi/' + encodeURIComponent(id) + '/' + name;
  // width / height: under 0.8 is tall (9:16 brick), 0.8 to 1.25 square, over 1.25 wide (16:9); 0 = unknown
  const shapeOf = ratio => (!ratio || ratio > 1.25 ? 'wide' : ratio < 0.8 ? 'tall' : 'square');
  const rounded = ratio => Math.round(ratio * 1000) / 1000;

  // Saved answers: video id -> [width / height, cover picture: 1 yes, 0 no, left out = not checked yet].
  const shapeStore = (() => {
    let known = null;
    const changed = new Map();
    let timer = 0;
    const read = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(SHAPES_KEY) || '{}');
        return new Map(saved && typeof saved === 'object' ? Object.entries(saved) : []);
      } catch (_) {
        return new Map();
      }
    };
    function save() {
      clearTimeout(timer);
      timer = 0;
      if (!changed.size) return;
      const all = read(); // keeps what other tabs saved in the meantime
      changed.forEach((entry, id) => { all.delete(id); all.set(id, entry); });
      changed.clear();
      while (all.size > SHAPES_KEPT) all.delete(all.keys().next().value); // oldest first
      try { localStorage.setItem(SHAPES_KEY, JSON.stringify(Object.fromEntries(all))); } catch (_) {}
      known = all;
    }
    return {
      get(id) {
        if (!known) known = read();
        const entry = known.get(id);
        return Array.isArray(entry) && typeof entry[0] === 'number' ? entry : null;
      },
      set(id, entry) {
        if (!known) known = read();
        known.set(id, entry);
        changed.set(id, entry);
        if (!timer) timer = setTimeout(save, 1500);
      },
      save
    };
  })();

  // Width and height from a JPEG's header, without decoding the picture.
  function jpegSize(bytes) {
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null;
    let i = 2;
    while (i + 8 < bytes.length) {
      if (bytes[i] !== 0xFF) { i++; continue; }
      const marker = bytes[i + 1];
      if (marker === 0xDA || marker === 0xD9) return null; // picture data starts: no size header found
      if (marker === 0xFF || marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { i += marker === 0xFF ? 1 : 2; continue; }
      if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
        return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
      }
      i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
    }
    return null;
  }

  // Fetches a picture through this server. Invidious never finishes the reply for a picture YouTube
  // doesn't have, so a missing one is cut off as soon as its status arrives.
  async function fetchPicture(url, read, waitMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), waitMs);
    try {
      const response = await fetch(url, { credentials: 'same-origin', signal: controller.signal });
      if (!response.ok) {
        controller.abort();
        return { missing: response.status === 404 };
      }
      return { body: await read(response) };
    } catch (_) {
      return {}; // network trouble or too slow: ask again another time
    } finally {
      clearTimeout(timer);
    }
  }

  // Width / height of a video: a number, 0 when YouTube has no first-frame picture (live streams), null when unsure.
  async function readRatio(id) {
    const reply = await fetchPicture(pictureUrl(id, 'frame0.jpg'), response => response.arrayBuffer(), 8000);
    if (reply.missing) return 0;
    if (!reply.body) return null;
    const bytes = new Uint8Array(reply.body);
    let size = jpegSize(bytes);
    if (!size && window.createImageBitmap) {
      try {
        const bitmap = await createImageBitmap(new Blob([bytes]));
        size = { width: bitmap.width, height: bitmap.height };
        bitmap.close();
      } catch (_) {}
    }
    return size && size.width && size.height ? size.width / size.height : null;
  }

  // The tall cover picture (Shorts have one): cover 1 = found (its width / height in ratio),
  // 0 = none, null = unsure. A found cover stays in the browser's cache for the tile.
  async function readCover(id) {
    const reply = await fetchPicture(pictureUrl(id, 'oar2.jpg'), response => response.arrayBuffer(), 10000);
    if (reply.missing) return { cover: 0 };
    if (!reply.body) return { cover: null };
    const size = jpegSize(new Uint8Array(reply.body));
    return { cover: 1, ratio: size && size.width && size.height ? size.width / size.height : 0 };
  }

  function preload(url) {
    const picture = new Image();
    picture.decoding = 'async';
    picture.src = url;
    const ready = picture.decode ? picture.decode().catch(() => {}) : Promise.resolve();
    return Promise.race([ready, new Promise(done => setTimeout(done, 3000))]);
  }

  // Gives a tile its shape and picture. Tall and square tiles show the tall cover when there is one,
  // otherwise the wide thumbnail over a blurred, zoomed copy of itself.
  function showShape(card, thumb, entry) {
    const shape = shapeOf(entry[0]);
    const cover = shape !== 'wide' && entry[1] === 1;
    const img = $('img.thumbnail', thumb);
    const coverSrc = pictureUrl(thumb.dataset.ptId, 'oar2.jpg');
    if (cover && img && img.getAttribute('src') !== coverSrc) img.src = coverSrc;
    if (shape === 'wide') { const blur = $('img.pt-blur', thumb); if (blur) blur.remove(); }
    if (shape !== 'wide' && !cover && img && !$('img.pt-blur', thumb)) {
      const blur = document.createElement('img');
      blur.className = 'pt-blur';
      blur.alt = '';
      blur.setAttribute('aria-hidden', 'true');
      blur.loading = 'lazy';
      blur.decoding = 'async';
      blur.src = img.getAttribute('src');
      img.before(blur);
    }
    const length = Number(thumb.dataset.ptLength) || 0;
    card.classList.toggle('pt-tall', shape === 'tall');
    card.classList.toggle('pt-square', shape === 'square');
    card.classList.toggle('pt-backdrop', shape !== 'wide' && !cover);
    card.classList.toggle('pt-short', shape === 'tall' || (shape === 'square' && length > 0 && length <= 180));
    card.classList.remove('pt-pending');
    scheduleLayout();
  }

  function prepareShape(card, thumb) {
    const entry = shapeStore.get(thumb.dataset.ptId);
    const shape = entry ? shapeOf(entry[0]) : SHORTS_PAGE ? 'tall' : 'wide';
    if (entry && (shape === 'wide' || entry.length > 1)) {
      showShape(card, thumb, entry); // already known: final shape before any picture loads
      return;
    }
    // Known to be tall (or on a Shorts tab): take the shape now, show the picture once the cover is in.
    if (shape !== 'wide') card.classList.add('pt-' + shape, 'pt-pending');
    unchecked.add(thumb);
    nearScreen.observe(thumb);
  }

  // A page opened in a background tab gets no screen updates (so no "near the screen" news either):
  // check the tiles in its first two screens right away, so the wall is final when the tab is opened.
  function checkHiddenPage() {
    if (!document.hidden) return;
    unchecked.forEach(thumb => {
      const box = thumb.getBoundingClientRect();
      if (box.top > innerHeight + 1500 || box.bottom < -1500) return;
      unchecked.delete(thumb);
      nearScreen.unobserve(thumb);
      waiting.add(thumb);
    });
    nextChecks();
  }

  async function measure(thumb) {
    const card = thumb.closest('.pt-card');
    const id = thumb.dataset.ptId;
    if (!card || !id) return;
    let entry = shapeStore.get(id);
    let found = null;
    if (!entry && SHORTS_PAGE) { // every tile here is a Short: its tall cover also tells the shape
      found = await readCover(id);
      if (found.cover === 1 && found.ratio) shapeStore.set(id, entry = [rounded(found.ratio), 1]);
    }
    if (!entry) {
      const ratio = await readRatio(id);
      if (ratio !== null) shapeStore.set(id, entry = [rounded(ratio)]);
    }
    if (!entry) { // no answer this time: keep the tile as it is and ask again on the next visit
      if (card.classList.contains('pt-pending')) showShape(card, thumb, [card.classList.contains('pt-square') ? 1 : 9 / 16]);
      return;
    }
    if (shapeOf(entry[0]) !== 'wide' && entry.length < 2) {
      if (!found || found.cover === null) found = await readCover(id);
      if (found.cover !== null) shapeStore.set(id, entry = [entry[0], found.cover]);
    }
    // Swap shape and picture together, once the cover is ready to show.
    if (shapeOf(entry[0]) !== 'wide' && entry[1] === 1) await preload(pictureUrl(id, 'oar2.jpg'));
    showShape(card, thumb, entry);
  }

  // Tiles within about two screens are checked, the ones on screen first (top to bottom), then nearest.
  const unchecked = new Set();
  const waiting = new Set();
  let checking = 0;
  const nearScreen = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      nearScreen.unobserve(entry.target);
      unchecked.delete(entry.target);
      waiting.add(entry.target);
    });
    nextChecks();
  }, { rootMargin: '1500px 0px' });

  function nextChecks() {
    while (checking < SHAPE_CHECKS && waiting.size) {
      let best = null, bestScore = Infinity;
      waiting.forEach(thumb => {
        if (!thumb.isConnected) { waiting.delete(thumb); return; }
        const box = thumb.getBoundingClientRect();
        const away = box.bottom < 0 ? -box.bottom : box.top > innerHeight ? box.top - innerHeight : 0;
        const score = away ? 1e6 + away : box.top;
        if (score < bestScore) { best = thumb; bestScore = score; }
      });
      if (!best) return;
      waiting.delete(best);
      checking++;
      const thumb = best;
      measure(thumb)
        .catch(error => {
          console.error('[pinless-look]', error);
          const card = thumb.closest('.pt-card');
          if (card) card.classList.remove('pt-pending'); // never leave a picture hidden
        })
        .finally(() => { checking--; nextChecks(); });
    }
  }

  /* ---------- Brick wall: equal columns, each tile placed in the shortest one (like Pinless) ---------- */
  const COLUMN = 290, GAP = 4; // 290px columns give 6 across a 1920px window, with Pinless's 4px gaps
  const brickWalls = new Set();
  let layoutFrame = 0;
  const sizes = new ResizeObserver(() => scheduleLayout());

  function scheduleLayout() {
    if (layoutFrame) return;
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0;
      brickWalls.forEach(wall => step(() => layoutWall(wall)));
    });
  }

  function brickWall(wall) {
    if (brickWalls.has(wall)) return;
    brickWalls.add(wall);
    sizes.observe(wall);
    step(() => layoutWall(wall)); // right away, so the page never shows the plain grid first
  }

  // If placing ever fails, the wall goes back to the plain grid instead of a pile of tiles.
  function layoutWall(wall) {
    try {
      placeTiles(wall);
    } catch (error) {
      wall.classList.remove('pt-bricks');
      throw error;
    }
  }

  function placeTiles(wall) {
    if (!wall.isConnected) {
      brickWalls.delete(wall);
      sizes.unobserve(wall);
      return;
    }
    const width = wall.clientWidth;
    if (!width) return;
    wall.classList.add('pt-bricks');
    const columns = Math.max(1, Math.floor((width + GAP) / (COLUMN + GAP)));
    const cell = (width - GAP * (columns - 1)) / columns;
    // Two regular landscape cards plus their gap, minus this card's frame.
    wall.style.setProperty('--pt-short-height', (2 * ((cell - 16) * 9 / 16 + 16) + GAP - 16) + 'px');
    const items = [...wall.children].filter(item => !item.hidden && item.style.display !== 'none' && !item.classList.contains('pt-playing-channel'));
    items.forEach(item => {
      item.ptSpan = Math.min(columns, item.classList.contains('pt-watch-featured') ? (document.body.classList.contains('pt-watch-tall') ? 1 : document.body.classList.contains('pt-watch-square') ? 2 : 3) : item.classList.contains('pt-playback-sized') ? 2 : 1);
      const itemWidth = cell * item.ptSpan + GAP * (item.ptSpan - 1);
      if (item.ptCell !== itemWidth) { item.style.setProperty('--pt-w', itemWidth + 'px'); item.ptCell = itemWidth; }
      if (!item.ptSized) { item.ptSized = true; sizes.observe(item); }
    });
    const heights = items.map(item => item.getBoundingClientRect().height); // one layout pass for all
    const occupied = Array.from({ length: columns }, () => []);
    items.forEach((item, i) => {
      if (!heights[i]) return; // hidden by a stylesheet
      let column = 0;
      const span = item.ptSpan;
      const topAt = c => {
        const blocks = occupied.slice(c, c + span).flat().sort((a, b) => a[0] - b[0]);
        let top = 0;
        for (const [start, end] of blocks) {
          if (top + heights[i] + GAP <= start + 0.5) break;
          if (top < end) top = end;
        }
        return top;
      };
      for (let c = 1; c <= columns - span; c++) if (topAt(c) < topAt(column) - 0.5) column = c;
      const x = column * (cell + GAP) + 'px';
      const top = topAt(column);
      const y = top + 'px';
      if (item.ptX !== x) { item.style.setProperty('--pt-x', x); item.ptX = x; }
      if (item.ptY !== y) { item.style.setProperty('--pt-y', y); item.ptY = y; }
      for (let c = column; c < column + span; c++) occupied[c].push([top, top + heights[i] + GAP]);
    });
    const height = Math.max(0, ...occupied.flat().map(block => block[1] - GAP)) + 'px';
    if (wall.ptHeight !== height) { wall.style.setProperty('--pt-h', height); wall.ptHeight = height; }
    placePlayingChannel(wall, occupied, cell, columns);
  }

  function placePlayingChannel(wall, occupied, cell, columns) {
    let board = $('.pt-playing-channel', wall);
    const playing = preview?.manual && preview.thumb.closest('.pt-card');
    const id = playing && preview.thumb.dataset.ptChannel;
    if (!playing || playing.parentElement !== wall || !/^UC[\w-]{22}$/.test(id || '')) {
      board?.remove(); return;
    }
    const top = parseFloat(playing.style.getPropertyValue('--pt-y')) || 0;
    const bottom = top + playing.getBoundingClientRect().height;
    const playingColumn = Math.round((parseFloat(playing.style.getPropertyValue('--pt-x')) || 0) / (cell + GAP));
    const candidates = [];
    for (let c = 0; c < columns; c++) {
      if (c >= playingColumn && c < playingColumn + playing.ptSpan) continue;
      let start = top;
      for (const [a, b] of [...occupied[c]].sort((x,y) => x[0]-y[0]).concat([[bottom + GAP, bottom + GAP]])) {
        const end = Math.min(a - GAP, bottom);
        if (end - start >= 110) candidates.push({c, start, height:end-start});
        start = Math.max(start, b);
        if (start >= bottom) break;
      }
    }
    const gap = candidates.sort((a,b) => Math.abs(a.c-playingColumn)-Math.abs(b.c-playingColumn) || b.height-a.height)[0];
    if (!gap) { board?.remove(); return; }
    if (!board || board.dataset.channel !== id) {
      board?.remove(); board = document.createElement('a'); board.className = 'pt-playing-channel'; board.dataset.channel = id;
      board.href = '/channel/' + id;
      const avatar = document.createElement('span'); avatar.className = 'pt-playing-avatar';
      const name = document.createElement('span'); name.textContent = preview.thumb.dataset.ptChannelName || 'Open channel';
      avatar.textContent = name.textContent.slice(0,1); board.append(avatar,name); wall.append(board);
      loadBoardAvatar(id, avatar);
    }
    board.style.setProperty('--pt-x', gap.c*(cell+GAP)+'px');
    board.style.setProperty('--pt-y', gap.start+'px');
    board.style.setProperty('--pt-w', cell+'px');
    board.style.height = gap.height+'px';
  }

  async function loadBoardAvatar(id, target) {
    try {
      let cached; try { cached = JSON.parse(localStorage.getItem('pt-channel-avatar:' + id)); } catch (_) {}
      let url = cached && Date.now()-cached.time < 7*86400000 && cached.url;
      if (!url) {
        const response = await fetch('/api/v1/channels/' + id, {signal:AbortSignal.timeout(15000)});
        if (!response.ok) return;
        const data = await response.json(); url = data.authorThumbnails?.slice().sort((a,b)=>b.width-a.width)[0]?.url;
      }
      if (!url) return;
      const parsed = new URL(url, location.origin);
      if (!['http:','https:'].includes(parsed.protocol)) return;
      const image = document.createElement('img'); image.alt = '';
      image.src = /^(yt3\.googleusercontent\.com|yt3\.ggpht\.com)$/.test(parsed.hostname) ? '/ggpht'+parsed.pathname+parsed.search : parsed.href;
      image.onload = () => target.replaceChildren(image);
    } catch (_) { /* Keep the channel initial when offline. */ }
  }

  /* ---------- Hover previews (like YouTube) ---------- */
  // Resting the mouse on the gray zone plays the video silently inside the tile, from about 15% in.
  // Leaving the gray zone stops it and drops the download. One preview at a time; the red and blue
  // zones never preview, and touch screens never do. Menu > Hover previews turns them off (per browser).
  // They stay on when Windows has animations turned off (reduced motion): they only start when asked
  // for by resting the mouse, so that setting only removes the fade-in.
  const PREVIEW_KEY = 'pt-previews';
  const PREVIEW_DELAY = 333;
  let preview = null, hoverPreview = null, previewTimer = 0, loadingThumb = null;
  function previewLoading(thumb, waiting = false) {
    if (loadingThumb === thumb && thumb) {
      const loader = $('.pt-preview-loader', thumb);
      if (loader) { loader.classList.toggle('pt-preview-wait', waiting); loader.setAttribute('aria-label', waiting ? 'Paused' : 'Loading video'); }
      return;
    }
    if (loadingThumb) {
      $('.pt-preview-loader', loadingThumb)?.remove();
      loadingThumb.removeAttribute('aria-busy');
    }
    loadingThumb = thumb;
    if (!thumb) return;
    const loader = document.createElement('span');
    loader.className = 'pt-preview-loader' + (waiting ? ' pt-preview-wait' : '');
    loader.setAttribute('role', 'status');
    loader.setAttribute('aria-label', waiting ? 'Waiting to preview' : 'Loading video');
    thumb.setAttribute('aria-busy', 'true');
    thumb.append(loader);
  }

  function previewsWanted() {
    let choice = null;
    try { choice = localStorage.getItem(PREVIEW_KEY); } catch (_) {}
    return choice !== 'off';
  }

  function previewSwitch() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pt-menu-item pt-preview-switch';
    const show = () => { button.textContent = 'Hover previews: ' + (previewsWanted() ? 'on' : 'off'); };
    show();
    button.addEventListener('click', () => {
      const on = !previewsWanted();
      try { localStorage.setItem(PREVIEW_KEY, on ? 'on' : 'off'); } catch (_) {}
      if (!on) stopPreview(true);
      show();
    });
    return button;
  }

  const previewStart = length => (length >= 8 ? Math.min(length * 0.15, 60) : 0);

  function playbackFailed(thumb) {
    const status = $('.pt-status', thumb);
    if (status) {
      status.textContent = 'Playback failed. Click gray to retry or blue to open the video.';
      status.hidden = false;
    }
    if (preview && preview.thumb === thumb) stopPreview();
  }

  // Volume hotkeys (2026-10-10): + and - change the volume of the video playing in the wall
  // (or the watch page player) in 10% steps. The level is remembered for the next video.
  const VOLUME_KEY = 'pt-inline-volume-v1';
  function savedVolume() { try { const v = Number(localStorage.getItem(VOLUME_KEY)); return v >= 0 && v <= 1 && localStorage.getItem(VOLUME_KEY) !== null ? v : 1; } catch (_) { return 1; } }
  let volumeNoteTimer = 0;
  function showVolume(host, level) {
    if (!host) return;
    let note = $('.pt-volume-note', host);
    if (!note) { note = document.createElement('div'); note.className = 'pt-volume-note'; note.setAttribute('role', 'status'); host.append(note); }
    note.textContent = level === 0 ? 'Muted' : 'Volume ' + Math.round(level * 100) + '%';
    note.classList.add('pt-volume-show');
    clearTimeout(volumeNoteTimer); volumeNoteTimer = setTimeout(() => note.classList.remove('pt-volume-show'), 900);
  }
  document.addEventListener('keydown', event => {
    const up = event.key === '+' || event.key === '=' || event.code === 'NumpadAdd';
    const down = event.key === '-' || event.key === '_' || event.code === 'NumpadSubtract';
    if ((!up && !down) || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (event.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role=textbox]')) return;
    const step = up ? 0.1 : -0.1;
    const inline = preview?.manual && preview.video?.isConnected ? preview.video : null;
    if (inline) {
      event.preventDefault(); event.stopImmediatePropagation();
      const start = inline.muted ? 0 : inline.volume;
      const level = Math.round(Math.min(1, Math.max(0, start + step)) * 10) / 10;
      inline.volume = level; inline.muted = level === 0;
      try { localStorage.setItem(VOLUME_KEY, String(level)); } catch (_) {}
      showVolume(preview.thumb, level);
      return;
    }
    const player = window.player;
    if (player && typeof player.volume === 'function' && $('video')) {
      event.preventDefault(); event.stopImmediatePropagation();
      const start = player.muted() ? 0 : player.volume();
      const level = Math.round(Math.min(1, Math.max(0, start + step)) * 10) / 10;
      player.volume(level); player.muted(level === 0);
      showVolume(player.el?.() || null, level);
    }
  }, true);

  // Menu > Loop video is Invidious's "Always loop" preference. A video you play inside a tile loops when it is on
  // Recheck on playback and follow successful setting changes in this tab and other tabs.
  // Hover previews always loop on their own.
  let loopPref = false, loopRevision = 0;
  function applyLoopPref(on) {
    loopPref = on;
    if (preview?.manual && preview.video) preview.video.loop = on;
  }
  window.addEventListener('pt-prefs-changed', event => {
    if (typeof event.detail?.video_loop !== 'boolean') return;
    loopRevision++;
    applyLoopPref(event.detail.video_loop);
  });
  function loopWanted() {
    const revision = ++loopRevision;
    window.ptPrefs?.read(['video_loop']).then(values => {
      if (revision === loopRevision && typeof values.video_loop === 'boolean') applyLoopPref(values.video_loop);
    }, () => {});
    return loopPref;
  }
  function startPreview(thumb, manual = false) {
    stopPreview(!manual);
    const id = thumb.dataset.ptId;
    if (!id || !thumb.isConnected) return;
    previewLoading(thumb);
    const length = Number(thumb.dataset.ptLength) || 0;
    const start = manual ? 0 : previewStart(length);
    const video = document.createElement('video');
    video.className = 'pt-preview';
    video.muted = !manual;
    if (manual) { const level = savedVolume(); video.volume = level; video.muted = level === 0; }
    video.defaultMuted = !manual;
    video.loop = manual ? loopWanted() : true;
    video.controls = manual;
    video.playsInline = true;
    video.preload = 'auto';
    video.disablePictureInPicture = true;
    video.tabIndex = manual ? 0 : -1;
    if (!manual) video.setAttribute('aria-hidden', 'true');
    thumb.classList.toggle('pt-inline-playing', manual);
    const status = $('.pt-status', thumb);
    if (status) status.hidden = true;
    // YouTube's single file with sound (360p), used for hover previews.
    video.src = '/companion/latest_version?id=' + encodeURIComponent(id) + '&itag=18&local=true' + (start ? '#t=' + start.toFixed(1) : '');
    video.addEventListener('loadedmetadata', () => {
      // Shorts tabs list every Short as 1:00, so trust the stream's own length when it differs.
      const real = video.duration;
      if (!manual && isFinite(real) && real > 0 && Math.abs(real - length) > 2) video.currentTime = previewStart(real);
    }, { once: true });
    video.addEventListener('playing', () => {
      if ((manual ? preview : hoverPreview)?.video !== video) return;
      if (loadingThumb === thumb) previewLoading(null);
      thumb.classList.add('pt-previewing', 'pt-media-playing');
      // Keep playback sizing through hover, pause and buffering. Only full playback
      // beginning on another card releases the previous expanded tiles.
      if (manual) {
        const card = thumb.closest('.pt-card');
        $$('.pt-playback-sized').forEach(other => {
          if (other !== card) other.classList.remove('pt-playback-sized');
        });
        if (card && !card.classList.contains('pt-short') && !card.classList.contains('pt-tall')) {
          card.classList.add('pt-playback-sized');
        }
        scheduleLayout();
      }
    });
    ['pause', 'ended'].forEach(event => video.addEventListener(event, () => {
      if ((manual ? preview : hoverPreview)?.video === video) { previewLoading(thumb, true); thumb.classList.remove('pt-media-playing'); }
    }));
    ['waiting', 'stalled'].forEach(event => video.addEventListener(event, () => {
      if ((manual ? preview : hoverPreview)?.video === video) previewLoading(thumb);
    }));
    thumb.append(video);
    if (manual) preview = { thumb, video, manual };
    else hoverPreview = { thumb, video, manual };
    scheduleLayout();
    video.addEventListener('error', () => {
      if ((manual ? preview : hoverPreview)?.video === video) { if (manual) playbackFailed(thumb); else stopPreview(true); }
    });
    if (manual && window.player && typeof window.player.pause === 'function') window.player.pause();
    const playing = video.play();
    if (playing && playing.catch) playing.catch(() => {
      if ((manual ? preview : hoverPreview)?.video === video) { if (manual) playbackFailed(thumb); else stopPreview(true); }
    });
  }

  function stopPreview(hoverOnly = false) {
    clearTimeout(previewTimer);
    previewTimer = 0;
    if (!hoverOnly || loadingThumb !== preview?.thumb) previewLoading(null);
    const stopped = [hoverPreview];
    hoverPreview = null;
    if (!hoverOnly) { stopped.push(preview); preview = null; }
    for (const state of stopped) {
      if (!state) continue;
      const { thumb, video } = state;
      thumb.classList.remove('pt-previewing', 'pt-inline-playing', 'pt-media-playing');
      video.pause();
      video.removeAttribute('src');
      video.load(); // ends the stream download
      video.remove();
    }
    scheduleLayout();
  }

  function watchPreviews() {
    document.addEventListener('keydown', event => {
      if (event.key.toLowerCase() !== 'z' || event.repeat || event.isComposing ||
          event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')) return;
      if ($('dialog[open]')) return;
      const video = preview?.manual && preview.video;
      if (!video?.isConnected || !video.requestFullscreen) return;
      if (document.fullscreenElement && document.fullscreenElement !== video) return;
      event.preventDefault();
      const action = document.fullscreenElement ? document.exitFullscreen() : video.requestFullscreen();
      if (action?.catch) action.catch(() => {
        const status = $('.pt-status', preview?.thumb);
        if (status) { status.textContent = 'Fullscreen unavailable. Try the fullscreen button on the video.'; status.hidden = false; }
      });
    });
    const grayZone = target => (target instanceof Element ? target.closest('.pt-open') : null);
    document.addEventListener('pointerover', event => {
      const zone = grayZone(event.target);
      if (!zone || event.pointerType !== 'mouse') return;
      const thumb = zone.closest('.pt-thumb');
      if (!thumb || preview?.thumb === thumb || hoverPreview?.thumb === thumb || loadingThumb === thumb) return;
      stopPreview(true);
      if (previewsWanted()) {
        previewLoading(thumb, true);
        previewTimer = setTimeout(() => startPreview(thumb), PREVIEW_DELAY);
      }
    });
    document.addEventListener('pointerout', event => {
      const zone = grayZone(event.target);
      if (zone && zone.closest('.pt-thumb') !== preview?.thumb && !(event.relatedTarget instanceof Node && zone.contains(event.relatedTarget))) stopPreview(true);
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopPreview(); });
  }

  /* ---------- Watch page: a tall player for Shorts ---------- */
  function setPoster(url) {
    const player = window.player;
    if (!player || typeof player.poster !== 'function') return;
    if (typeof player.hasStarted === 'function' && player.hasStarted()) return;
    player.poster(url);
  }

  function watchShape() {
    if (location.pathname !== '/watch') return;
    const id = new URLSearchParams(location.search).get('v');
    if (!id || !$('#player-container')) return;
    let shown = 0;
    const show = ratio => {
      if (!ratio || Math.abs(ratio - shown) < 0.01) return;
      shown = ratio;
      const shape = shapeOf(ratio);
      document.body.classList.toggle('pt-watch-tall', shape === 'tall');
      document.body.classList.toggle('pt-watch-square', shape === 'square');
    };
    let entry = shapeStore.get(id);
    if (entry) show(entry[0]);
    if (entry && entry[1] === 1 && shapeOf(entry[0]) !== 'wide') setPoster(pictureUrl(id, 'oar2.jpg'));
    // The player's own picture size settles it once the video loads (Invidious always says 16:9).
    const video = $('#player-container video');
    if (video) {
      const fromVideo = () => { if (video.videoWidth && video.videoHeight && !document.body.classList.contains('pt-watch-cropped')) show(video.videoWidth / video.videoHeight); };
      video.addEventListener('loadedmetadata', fromVideo);
      video.addEventListener('resize', fromVideo);
      fromVideo();
      watchCrop(id, video, ratio => { shown = 0; show(ratio); });
    }
    if (entry && (shapeOf(entry[0]) === 'wide' || entry.length > 1)) return;
    (async () => {
      if (!entry) {
        const ratio = await readRatio(id);
        if (ratio === null) return;
        shapeStore.set(id, entry = [rounded(ratio)]);
        show(entry[0]);
      }
      if (shapeOf(entry[0]) === 'wide') return;
      const { cover } = await readCover(id);
      if (cover === null) return;
      shapeStore.set(id, [entry[0], cover]);
      if (cover === 1) setPoster(pictureUrl(id, 'oar2.jpg'));
    })().catch(() => {});
  }

  /* ---------- Watch page: pictures with black side bars (2026-10-14) ----------
     Many music uploads are a square cover inside a 16:9 video, with black bars on both sides. A few
     frames are measured while it plays; when both sides are black in all of them, the player takes
     the picture's real shape (square or tall, so it uses fewer columns) and the bars are cropped.
     Fullscreen still shows the whole frame. The answer is remembered for that video. */
  const CROP_KEY = 'pt-watch-crop-v1';
  function readCrops() { try { const v = JSON.parse(localStorage.getItem(CROP_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } }
  function saveCrop(id, ratio) {
    try {
      const all = readCrops();
      delete all[id];
      all[id] = ratio;
      const keys = Object.keys(all);
      keys.slice(0, Math.max(0, keys.length - 500)).forEach(key => delete all[key]);
      localStorage.setItem(CROP_KEY, JSON.stringify(all));
    } catch (_) {}
  }
  function watchCrop(id, video, show) {
    const known = readCrops()[id];
    const apply = ratio => { document.body.classList.add('pt-watch-cropped'); show(ratio); scheduleLayout(); };
    if (typeof known === 'number' && known > 0) { apply(known); return; }
    const W = 160, canvas = document.createElement('canvas');
    let samples = 0, left = Infinity, right = -1, top = Infinity, bottom = -1, height = 0, timer = 0, tries = 0;
    const stop = () => { clearInterval(timer); timer = 0; };
    const measure = () => {
      if (++tries > 30) { stop(); return; }
      if (video.paused || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
      const h = Math.max(9, Math.round(W * video.videoHeight / video.videoWidth));
      if (height && h !== height) { stop(); return; }
      height = h;
      canvas.width = W;
      canvas.height = h;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      let data;
      try { context.drawImage(video, 0, 0, W, h); data = context.getImageData(0, 0, W, h).data; } catch (_) { stop(); return; }
      let lit = 0, l = Infinity, r = -1, t = Infinity, b = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (data[i] + data[i + 1] + data[i + 2] > 54) { lit++; if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; }
      }
      if (lit < W * h * 0.05) return; // a dark scene says nothing about bars
      left = Math.min(left, l); right = Math.max(right, r); top = Math.min(top, t); bottom = Math.max(bottom, b);
      if (++samples < 3) return;
      stop();
      const sideLeft = left / W, sideRight = (W - 1 - right) / W;
      if (sideLeft < 0.08 || sideRight < 0.08 || Math.abs(sideLeft - sideRight) > 0.04) return;
      const ratio = Math.round(((right - left + 1) / (bottom - top + 1)) * (video.videoWidth / video.videoHeight) / (W / h) * 1000) / 1000;
      if (!(ratio > 0.4 && ratio <= 1.25)) return;
      saveCrop(id, ratio);
      apply(ratio);
    };
    const begin = () => { if (!timer && tries <= 30) timer = setInterval(measure, 1500); };
    video.addEventListener('playing', begin);
    video.addEventListener('pause', stop);
    if (!video.paused) begin();
  }

  /* ---------- External tools (red zone) ---------- */
  function startDownload(id, title, button, status, transcript = false) {
    const report = message => { status.textContent = message; status.hidden = false; };
    if (window.ptExternalTools) window.ptExternalTools.open(id, transcript, report);
    else report('External tools unavailable. Reload this page.');
  }

  /* ---------- Watch page ---------- */
  function buildRelated(column, after) {
    const section = document.createElement('section');
    section.className = 'pt-related';
    section.setAttribute('aria-label', 'Related videos');
    const head = document.createElement('div');
    head.className = 'pt-related-head';
    const heading = document.createElement('h2');
    heading.textContent = 'Related videos';
    head.append(heading);
    const autoplay = $('#continue', column);
    const control = autoplay && autoplay.closest('.pure-control-group');
    if (control) head.append(control);
    section.append(head);
    const playlist = $('#playlist', column);
    if (playlist) section.append(playlist);
    const wall = document.createElement('div');
    wall.className = 'pt-wall pt-related-wall';
    $$('div.thumbnail', column).forEach(thumb => {
      const card = thumb.parentElement;
      if (!card || card === column || card.closest('#playlist')) return;
      wall.append(card);
      makeTile(card, thumb);
    });
    section.append(wall);
    after.after(section);
    const featured = document.createElement('article');
    featured.className = 'pt-watch-featured';
    featured.setAttribute('aria-label', 'Selected video');
    wall.prepend(featured);
    featured.append($('#player-container'), after);
    head.remove();
    after.append(head);
    watchExtras(featured, after, section, wall);
    if (wall.isConnected) brickWall(wall);
  }

  function watchExtras(featured, info, section, wall) {
    const player = $('#player-container', featured), id=new URLSearchParams(location.search).get('v');
    const profile=$('.channel-profile',info), channelLink=profile?.closest('a[href^="/channel/"]') || $('a[href^="/channel/"]',info);
    const channelId=channelLink?.getAttribute('href').split('/')[2], name=textOf($('#channel-name',info))||textOf(profile)||'Channel';
    const subscribe=$('#subscribe',info);
    // Like a Pinless pin page (2026-10-12): the creator's name, an amber pill between dotted lines,
    // takes the place of the search terms. Click opens the channel; A/X over it subscribes/unsubscribes.
    // The search field stays a normal search.
    const form=$('.pt-header .pt-search'), channelHref=channelLink?.getAttribute('href')||'';
    document.body.classList.add('pt-watch-creator-page');
    const nav=document.createElement('div');nav.className='pt-watch-creator-nav';
    const card=document.createElement('a');card.className='pt-watch-creator-card';card.href=channelHref||'#';card.textContent=name;
    card.title='Open '+name+' channel'+(subscribe?' · A to subscribe · X to unsubscribe':'');nav.append(card);
    if(form)form.after(nav);else $('.pt-header')?.append(nav);
    if(subscribe){const holder=document.createElement('div');holder.hidden=true;holder.append(subscribe.closest('form')||subscribe);nav.append(holder);
      document.addEventListener('keydown',e=>{const key=e.key.toLowerCase();if(!['a','x'].includes(key)||e.repeat||e.ctrlKey||e.altKey||e.shiftKey||e.metaKey||e.isComposing||e.target.closest('input,textarea,select,[contenteditable=true]')||$('dialog[open]')||(!card.matches(':hover')&&document.activeElement!==card))return;const active=subscribe.onclick?.name==='unsubscribe'||/unsubscribe/i.test(subscribe.textContent);if(key==='a'&&!active||key==='x'&&active){e.preventDefault();e.stopImmediatePropagation();subscribe.click();}},true);
    }
    profile?.closest('.title')?.remove();
    const compact=document.createElement('details');compact.className='quiet-disclosure pt-watch-extra-details';const summary=document.createElement('summary');summary.textContent='Details';compact.append(summary);
    [...info.children].filter(n=>!n.matches('.h-box')).forEach(n=>compact.append(n));info.append(compact);
    const red=document.createElement('button');red.type='button';red.className='pt-main-download';red.title='Open downloader · Ctrl/⌘-click: transcript';red.setAttribute('aria-label',red.title);
    const status=document.createElement('span');status.className='pt-status';status.hidden=true;status.setAttribute('role','status');
    red.onclick=e=>{e.preventDefault();e.stopPropagation();startDownload(id,textOf($('h1',info)),red,status,e.ctrlKey || e.metaKey);};player.append(red,status,label('pt-main-title',textOf($('h1',info))));
    player.addEventListener('click',e=>{if(e.ctrlKey&&e.button===0&&!e.target.closest('.pt-main-download')){e.preventDefault();e.stopImmediatePropagation();window.open('https://www.youtube.com/watch?v='+encodeURIComponent(id),'_blank','noopener,noreferrer');}},true);
    // Click anywhere on the picture to start; retain native seek/volume controls.
    player.addEventListener('click',e=>{if(!e.target.matches('.vjs-poster')||e.ctrlKey)return;const video=$('video',player);if(video?.paused)video.play().catch(()=>{});});
    const seen=new Set([id,...$$('.pt-thumb',wall).map(n=>n.dataset.ptId)]), visited=new Set(), queue=[id,...seen].filter(Boolean);
    const bar=document.createElement('div');bar.className='pt-watch-more';const message=document.createElement('span');message.setAttribute('role','status');const more=document.createElement('button');more.type='button';more.textContent='Load more videos';bar.append(message,more);section.append(bar);let busy=false,failed=false;
    async function load(){if(busy)return;busy=true;failed=false;more.disabled=true;message.textContent='Finding more related videos…';let added=0;
      try{for(let tries=0;tries<3&&queue.length&&!added;tries++){const source=queue.shift();if(visited.has(source)){tries--;continue;}try{const r=await fetch('/api/v1/videos/'+encodeURIComponent(source)+'?fields=recommendedVideos',{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error();const data=await r.json();if(!Array.isArray(data.recommendedVideos))throw Error();visited.add(source);for(const video of data.recommendedVideos){if(!/^[\w-]{11}$/.test(video.videoId||'')||seen.has(video.videoId))continue;seen.add(video.videoId);queue.push(video.videoId);const card=document.createElement('div'),box=document.createElement('div'),thumb=document.createElement('div'),link=document.createElement('a'),img=document.createElement('img'),row=document.createElement('div'),title=document.createElement('a'),author=document.createElement('a');box.className='h-box';thumb.className='thumbnail';link.href='/watch?v='+video.videoId;img.className='thumbnail';img.src='/vi/'+video.videoId+'/mqdefault.jpg';img.alt=video.title||'Video';img.loading='lazy';link.append(img);thumb.append(link);row.className='video-card-row';title.href=link.href;title.textContent=video.title||'Video';author.href='/channel/'+video.authorId;author.textContent=video.author||'';row.append(title,author);box.append(thumb,row);card.append(box);wall.append(card);makeTile(card,thumb);added++;}}catch(error){queue.unshift(source);throw error;}}
        message.textContent=queue.length?'':'No more related videos are available.';more.hidden=!queue.length;scheduleLayout();
      }catch(_){failed=true;message.textContent='More videos could not load. Your current videos are kept.';more.textContent='Retry';}
      finally{busy=false;more.disabled=false;if(!failed&&queue.length&&bar.getBoundingClientRect().top<innerHeight+500)setTimeout(load,400);}}
    more.onclick=load;new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)&&!failed)load();},{rootMargin:'600px'}).observe(bar);
  }

  function buildWatch() {
    if (location.pathname !== '/watch') return;
    const player = $('#player-container');
    if (!player) return;
    document.body.classList.add('pt-watch');
    const next = player.nextElementSibling;
    const titleBox = next && next.matches('.h-box') ? next : null;
    // Columns of the video's own row only (never #contents or the page wrapper around it).
    const column = '#contents .pure-g > [class*="pure-u-"]';
    const description = $('#description-box');
    const main = description && description.closest(column);
    const row = main && main.parentElement;
    const youtubeLinks = $('#watch-on-youtube');
    const tools = youtubeLinks && youtubeLinks.closest(column);

    const info = document.createElement('section');
    info.className = 'pt-watch-info';
    info.setAttribute('aria-label', 'Video details');
    player.after(info);
    if (titleBox) info.append(titleBox);
    if (main) {
      main.classList.add('pt-watch-main');
      info.append(main);
    }
    fold(description, 'Description');
    fold($('#comments'), 'Comments');
    if (tools && tools !== main) {
      tools.classList.add('pt-watch-tools');
      const details = fold(tools, 'Video actions & details', 'pt-tools');
      if (details) info.append(details);
    }
    const related = row && [...row.children].find(child => child !== main && child !== tools && !child.matches('details'));
    if (related) buildRelated(related, info);
    if (row && !row.contains(info)) hide(row);
  }

  /* ---------- Subscriptions and a reversible, browser-local hidden feed ---------- */
  function subscriptionWall() {
    if (location.pathname !== '/subscription_manager') return;
    const historyLink = $$('#contents a[href="/feed/history"]').find(link => !link.closest('.pt-header'));
    const toolbar = historyLink?.closest('.pure-g');
    if (toolbar && !$('form[action^="/subscription_ajax"]', toolbar)) hide(toolbar);
    $$('#contents a[href*="/data_control"], #contents a[href*="/subscription_manager?action="]').forEach(hide);
    const cards = $$('#contents form[action^="/subscription_ajax"]').map(form => form.closest('.pure-g')?.parentElement).filter(Boolean);
    if (!cards.length) return;
    const wall = document.createElement('div');
    wall.className = 'pt-subscriptions';
    const queue = [];
    let active = 0;
    const pump = () => {
      while (active < 3 && queue.length) {
        active++;
        queue.shift()().finally(() => { active--; pump(); });
      }
    };
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      queue.push(entry.target.ptLoadAvatar);
      pump();
    }), { rootMargin: '400px' });
    cards[0].before(wall);
    cards.forEach(card => {
      card.classList.add('pt-subscription');
      const link = $('a[href^="/channel/"]', card);
      if (link) {
        const name = textOf(link);
        const form = $('form[action^="/subscription_ajax"]', card);
        const submit = form && $('input[type="submit"],button[type="submit"],button:not([type])', form);
        link.textContent = ''; link.setAttribute('aria-label', 'Open ' + name);
        link.append(label('pt-channel-name', name));
        if (submit) {
          const button = submit;
          button.classList.add('pt-unsubscribe-name');
          if (button.tagName === 'INPUT') button.value = name; else button.textContent = name;
          button.title = 'Unsubscribe from ' + name; button.setAttribute('aria-label', button.title);
          if (submit.name) { button.name = submit.name; button.value = submit.value; }
        }
        const avatar = document.createElement('span');
        avatar.className = 'pt-channel-letter';
        avatar.setAttribute('aria-hidden', 'true');
        avatar.textContent = name.slice(0, 1).toUpperCase();
        link.prepend(avatar);
        avatar.ptLoadAvatar = async () => {
          const id = new URL(link.href).pathname.split('/')[2];
          const key = 'pt-channel-avatar:' + id;
          const show = url => {
            const parsed = new URL(url, location.origin);
            if (!['https:', 'http:'].includes(parsed.protocol)) return;
            const img = document.createElement('img');
            img.className = 'pt-channel-avatar';
            img.alt = '';
            img.decoding = 'async';
            img.onload = () => avatar.replaceChildren(img);
            img.onerror = () => { try { localStorage.removeItem(key); } catch (_) {} };
            img.src = /^(yt3\.googleusercontent\.com|yt3\.ggpht\.com)$/.test(parsed.hostname)
              ? '/ggpht' + parsed.pathname + parsed.search : parsed.href;
          };
          try {
            let cached;
            try { cached = JSON.parse(localStorage.getItem(key)); } catch (_) {}
            if (cached && Date.now() - cached.time < 7 * 86400000) { show(cached.url); return; }
            const response = await fetch('/api/v1/channels/' + encodeURIComponent(id), { signal: AbortSignal.timeout(15000) });
            if (!response.ok) return;
            const data = await response.json();
            const images = (data.authorThumbnails || []).filter(image => image.url).sort((a, b) => b.width - a.width);
            if (!images.length) return;
            const url = images[0].url;
            show(url);
            try { localStorage.setItem(key, JSON.stringify({ url, time: Date.now() })); } catch (_) {}
          } catch (_) { /* Keep the initial if the channel is unavailable. */ }
        };
        observer.observe(avatar);
      }
      wall.append(card);
    });
  }

  function shuffleManagerWall() {
    if (!['/subscription_manager', '/feed/history', '/search'].includes(location.pathname)) return;
    let pointer = null;
    document.addEventListener('pointermove', event => {pointer = [event.clientX, event.clientY];}, {passive:true});
    document.documentElement.addEventListener('pointerleave', () => {pointer = null;});
    addEventListener('blur', () => {pointer = null;});
    document.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.key.toLowerCase() !== 's') return;
      if ($('dialog[open]') || event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')) return;
      const target = pointer && document.elementFromPoint(...pointer);
      if (!target || target.closest('.pt-header') || !target.closest('#contents')) return;
      const walls = $$('.pt-subscriptions,.pt-wall');
      if (!walls.length) return;
      event.preventDefault(); event.stopImmediatePropagation();
      walls.forEach(wall => {
        const cards = [...wall.children];
        for (let i = cards.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [cards[i], cards[j]] = [cards[j], cards[i]];
        }
        wall.append(...cards);
      });
      scheduleLayout();
    }, true);
  }

  const HIDDEN_KEY = 'pt-hidden-feed-v1';
  const isFeed = () => ['/feed/subscriptions', '/search'].includes(location.pathname);
  // The Hidden videos page (hidden-page.js) lists the hidden videos; it must not hide them again.
  const isHiddenPage = () => location.pathname === '/search' && new URLSearchParams(location.search).get('pt_page') === 'hidden';
  function readHidden() {
    try {
      const saved = JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]');
      return Array.isArray(saved) ? saved.filter(v => v && typeof v.id === 'string' && /^[\w-]+$/.test(v.id)) : [];
    } catch (_) { return []; }
  }
  function saveHidden(items) {
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(items)); return true; }
    catch (_) { alert('Could not save hidden items. Please allow browser storage and try again.'); return false; }
  }
  function filterHiddenFeed() {
    if (!isFeed() || isHiddenPage()) return;
    const ids = new Set(readHidden().map(v => v.id));
    $$('.pt-video').forEach(card => {
      const thumb = $('.pt-thumb', card);
      // Search tags (search-tags.js) can also hide a tile; either reason keeps it hidden.
      card.hidden = (!!thumb && ids.has(thumb.dataset.ptId)) || card.dataset.ptTagHidden === 'true';
      if (card.hidden && preview?.thumb === thumb) stopPreview();
      else if (card.hidden && hoverPreview?.thumb === thumb) stopPreview(true);
    });
    scheduleLayout();
  }
  function hiddenFeedControls() {
    const button = document.createElement('button');
    button.className = 'pt-menu-item';
    button.textContent = 'Hidden videos';
    $('.quiet-menu-panel')?.append(button);
    // The round Hidden videos button opens the Hidden videos page (hidden-page.js).
    button.onclick = () => { location.href = '/search?pt_page=hidden'; };
    let hovered = null, armed = null;
    const itemAt = target => target instanceof Element ? target.closest('.pt-video,.pt-subscription') : null;
    function selectItem(card) {
      if (card !== hovered) { clear(); hovered = card; }

    }
    document.addEventListener('focusin', event => selectItem(itemAt(event.target)));
    // Keep the upstream history request/CSRF handling; relayout after removal or rollback.
    if (location.pathname === '/feed/history' || location.pathname === '/subscription_manager') {
      new MutationObserver(records => {
        let changed = false;
        records.forEach(r => {
          if (r.type !== 'attributes' || r.attributeName !== 'style') return;
          const card = r.target.closest('.pt-card');
          if (!card || (r.oldValue || '').includes('display: none') === (r.target.style.display === 'none')) return;
          // Upstream hides the inner h-box and restores it if the request fails.
          if (r.target.parentElement === card && r.target.classList.contains('h-box')) {
            card.style.display = r.target.style.display === 'none' ? 'none' : '';
          }
          if (r.target === card || r.target.parentElement === card) changed = true;
        });
        if (changed) scheduleLayout();
      }).observe($('#contents'), {subtree:true, attributes:true, attributeFilter:['style'], attributeOldValue:true});
    }
    function clear() {
      if (armed) {
        armed.classList.remove('pt-hide-armed');
        $('.pt-hide-hint', armed)?.remove();
      }
      armed = null;
    }
    document.addEventListener('pointerover', event => {
      selectItem(itemAt(event.target));
    });
    document.addEventListener('pointerout', event => {
      if (hovered && !hovered.contains(event.relatedTarget)) { clear(); hovered = null; }
    });
    addEventListener('blur', clear);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') { clear(); return; }
      if (isHiddenPage()) return;
      if (!(isFeed() || location.pathname === '/feed/history' || location.pathname === '/subscription_manager') || !hovered || hovered.hidden || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.key.toLowerCase() !== 'x') return;
      if (document.querySelector('dialog[open]') || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (armed !== hovered) {
        clear(); armed = hovered; armed.classList.add('pt-hide-armed');
        const hint = document.createElement('span');
        hint.className = 'pt-hide-hint';
        hint.textContent = hovered.classList.contains('pt-subscription') ? 'Press X again to unsubscribe · Esc to cancel' : 'Press X again to hide · Esc to cancel';
        hint.setAttribute('role', 'status');
        ($('.pt-thumb', armed) || armed).append(hint);
        return;
      }
      if (hovered.classList.contains('pt-subscription')) {
        const form = $('form[action^="/subscription_ajax"]', hovered);
        const submit = form && $('button[type="submit"],button:not([type]),input[type="submit"]', form);
        clear();
        if (submit) submit.click(); else if (form) form.requestSubmit();
        return;
      }
      if (location.pathname === '/feed/history') {
        const target = $('[data-onclick="mark_unwatched"]', hovered);
        if (preview?.thumb.closest('.pt-card') === hovered) stopPreview();
        else if (hoverPreview?.thumb.closest('.pt-card') === hovered) stopPreview(true);
        clear(); target?.click(); scheduleLayout(); hovered = null; return;
      }
      const thumb = $('.pt-thumb', hovered);
      const id = thumb.dataset.ptId;
      const items = readHidden().filter(v => v.id !== id);
      items.unshift({ id, title: textOf($('.pt-label-title', hovered)), hiddenAt: Date.now() });
      if (saveHidden(items)) { clear(); filterHiddenFeed(); hovered = null; }
    }, true);
    addEventListener('storage', event => {
      if (event.key === HIDDEN_KEY || event.key === null) { clear(); filterHiddenFeed(); }
    });
  }

  /* ---------- Start ---------- */
  // Each part runs on its own, so a problem in one never leaves the page half-built or blank.
  function step(part) {
    try { part(); } catch (error) { console.error('[pinless-look]', error); }
  }


  function navigationPages() {
    const view = new URLSearchParams(location.search).get('pt_page');
    if(view==='filters'){location.replace('/feed/subscriptions');return;}
    const page = view === 'menu' ? view : null;
    const header = $('.pt-header');
    if (!header) return;
    const menu = $('.pt-menu', header), filters = $('.pt-filters', header);
    // Search navigation belongs to this tab only.
    const sandboxKey = 'pt-sandbox-search-v2';
    const defaultSandbox = '/search?pt_page=discover';
    const validSearch = value => {
      try { const url = new URL(value, location.origin); return url.origin === location.origin && url.pathname === '/search' ? url.pathname + url.search + url.hash : null; } catch (_) { return null; }
    };
    if (location.pathname === '/search' && view === 'hidden') {
      document.title = 'Hidden videos';
    } else if (location.pathname === '/search') {
      const current = location.pathname + location.search + location.hash;
      try { sessionStorage.setItem(sandboxKey, current); } catch (_) {}

      const params = new URLSearchParams(location.search), query = (params.get('q') || '').trim();
      const restoring = params.get('pt_restore') === '1';
      document.title = view === 'discover' ? 'Search Groups Feed' : restoring ? 'Restore Feed' : query || 'Search';
      // A plain search lights up the search bar (like a creator's page), not the Restore Feed button.
      if (view !== 'discover' && view !== 'youtube' && !restoring) document.body.classList.add('pt-search-lit');
    }
    const sandbox = document.createElement('a');
    sandbox.className = 'pt-circle pt-sandbox-link';
    sandbox.title = 'Restore Feed'; sandbox.setAttribute('aria-label', 'Restore Feed');
    sandbox.innerHTML = icon('<rect x="5" y="5" width="14" height="14" transform="rotate(45 12 12)"/><circle cx="12" cy="12" r="2.5"/>');
    let lastSearch;
    try { lastSearch = validSearch(sessionStorage.getItem(sandboxKey)); } catch (_) {}

    sandbox.href = window.ptSandbox?.href() || lastSearch || '/feed/subscriptions';
    sandbox.rel = 'noopener';
    // Header order (2026-10-11): Subscriptions Feed sits right after the playlist name (before the magnifier and
    // search bar); Restore Feed stays after the search terms, just before Subscriptions, History and Account.
    { const brandLink = $('.pt-brand', header), navBar = $('.pt-nav', header);
      if (navBar) navBar.before(sandbox); else header.append(sandbox);
      if (brandLink) {
        const controls = $('.pt-following-controls', header), following = $('.pt-follow', header);
        if (controls) { if (brandLink.parentElement !== controls) controls.prepend(brandLink); }
        else if (following) following.before(brandLink);
      } }
    // The Search Groups Feed opens from the magnifying glass beside the search group name (interest-bar.js).
    function pageLink(old, name, kind) {
      if (!old) return;
      const link = document.createElement('a');
      link.className = 'pt-circle pt-' + kind + '-link';
      link.href = '/feed/subscriptions?pt_page=' + kind;
      link.innerHTML = $('summary', old).innerHTML;
      link.title = name; link.setAttribute('aria-label', name);
      if (kind === 'filters') {
        const update = () => { const url = new URL(link.href); const query = $('.pt-search input[name=q]')?.value.trim(); if(query) url.searchParams.set('q',query); else url.searchParams.delete('q'); link.href=url.pathname+url.search; };
        $('.pt-search input[name=q]')?.addEventListener('input', update); update();
      }
      old.before(link);
      old.hidden = true;
      old.style.setProperty('display','none','important');
    }
    pageLink(menu, 'Menu', 'menu');
    if (page) {
      const main = document.createElement('main'); main.className='pt-navigation-page';
      main.setAttribute('aria-label',page === 'menu' ? 'Menu' : 'Filters');
      if (page !== 'menu') { const title=document.createElement('h1'); title.textContent='Filters'; main.append(title); }
      const content = page === 'menu' ? $('.quiet-menu-panel', menu) : $('#filters-box',filters);
      const shell=document.createElement('section');shell.className=page === 'menu' ? 'pt-menu pt-page-panel' : 'pt-filters pt-page-panel';
      if(content) shell.append(content); main.append(shell);
      const contents=$('#contents');
      [...contents.children].forEach(child=>{if(child!==header && !child.contains(header) && child.tagName!=='DIALOG') child.remove();});
      contents.append(main);
      document.body.classList.add('pt-navigation-view');
      document.documentElement.classList.remove('pt-feed-loading');
      document.title=title.textContent+' · individuous';
      if(page==='filters') {
        $('.pt-search input[name=q]').value=new URLSearchParams(location.search).get('q') || '';
        const note=document.createElement('p');note.className='pt-page-note';note.textContent='Choices are saved automatically for your next search.';shell.prepend(note);
      }
    }
    const selector = new URLSearchParams(location.search).get('pt_restore') === '1' ? '.pt-sandbox-link' : view === 'discover' ? '.pt-discover-link' : page ? '.pt-'+page+'-link' : location.pathname==='/star.html' ? '.pt-star-link' : location.pathname==='/search-term-manager.html' ? '.pt-terms' : location.pathname==='/subscription_manager' ? '.pt-follow' : location.pathname==='/feed/history' ? '.pt-history' : ['/', '/feed/subscriptions'].includes(location.pathname) ? '.pt-brand' : null;
    $$('[aria-current=page]',header).forEach(el=>{if(!el.closest('.pt-channel-bar'))el.removeAttribute('aria-current');});
    if(selector) {
      const current = $(selector,header);
      current?.setAttribute('aria-current','page');
      const names = {'.pt-brand':'Subscriptions Feed','.pt-sandbox-link':'Restore Feed','.pt-discover-link':'Search Groups Feed','.pt-filters-link':'Filters','.pt-star-link':'Playlists','.pt-terms':'Search Groups','.pt-follow':'Subscriptions','.pt-history':'Watch History','.pt-menu-link':'Menu'};
      document.title = names[selector];
    }
    if(location.pathname==='/search-term-manager.html') $('a[href="/search-term-manager.html"]',header)?.setAttribute('aria-current','page');
  }

  function start() {
    window.ptPlaylistWallVersion = 1;
    document.body.classList.add('pt-youtube');
    if (location.pathname === '/search') document.body.classList.add('pt-search-page');
    if (location.pathname === '/feed/history') document.body.classList.add('pt-history-page');
    if (location.pathname === '/feed/subscriptions') document.body.classList.add('pt-feed-page');
    [buildHeader, headerIcons, listControls, listHotkey, renderStars, tidyFilters, tidySubscriptions, subscriptionWall, shuffleManagerWall, hiddenFeedControls, historyClearControls, buildWatch, watchShape, scanWalls, watchPreviews,
      () => $('footer')?.remove()].forEach(step);
    document.addEventListener('continuous:appended', () => step(scanWalls));
    document.addEventListener('feed:replacing', () => {
      stopPreview();
      unchecked.forEach(thumb => { nearScreen.unobserve(thumb); });
      unchecked.clear();
      waiting.clear();
    });
    addEventListener('pagehide', () => { stopPreview(); shapeStore.save(); });
    setTimeout(() => step(navigationPages), 0);
    setTimeout(() => step(checkForNewBuild), 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
