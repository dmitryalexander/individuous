/* Named creator feeds, using the shared A/R/X picker and account follows. */
;(() => {
  'use strict';
  const M = window.ptFollowingGroupModel;
  const params = new URLSearchParams(location.search);
  const manager = location.pathname === '/subscription_manager';
  const feed = location.pathname === '/feed/subscriptions' && !params.has('pt_page');
  let label, summary, dialog, pointer = null, armed = null, armTimer;
  const read = () => M.read(localStorage.getItem(M.KEY));
  function save(data) { M.validate(data); localStorage.setItem(M.KEY, JSON.stringify(data)); }
  function scoped() {
    const data = read(), id = params.get('pt_following');
    if ((feed || manager) && id) {
      if (!data.lists.some(group => group.id === id)) throw Error('This following group no longer exists. Choose another group.');
      data.activeId = id;
    }
    return data;
  }
  function url(path, id) { return path + '?' + new URLSearchParams({pt_following:id}); }
  function report(message) {
    if (!summary) {
      summary = document.createElement('p'); summary.className = 'pt-following-message'; summary.setAttribute('role','status');
      const contents = document.querySelector('#contents'), anchor = contents?.querySelector('.pt-following-manager,.pt-header');
      if (anchor) anchor.after(summary); else contents?.prepend(summary);
    }
    summary.textContent = message;
  }
  function channels(doc) {
    return [...doc.querySelectorAll('form[action^="/subscription_ajax"]')].map(form => {
      const id = new URL(form.getAttribute('action'),location.origin).searchParams.get('c');
      const card = form.closest('.pt-subscription') || form.closest('.pure-g')?.parentElement;
      const link = card?.querySelector('a[href^="/channel/"]');
      return /^UC[\w-]{22}$/.test(id || '') ? {id, name:(link?.querySelector('.pt-channel-name')?.textContent || link?.textContent || id).trim(), card} : null;
    }).filter(Boolean);
  }
  async function followed() {
    if (manager) return channels(document);
    const response = await fetch('/subscription_manager',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
    if (!response.ok || new URL(response.url).pathname === '/login') throw Error('Could not read who you follow. Try again.');
    const doc = new DOMParser().parseFromString(await response.text(),'text/html');
    if (!doc.querySelector('a[href="/feed/history"]')) throw Error('Could not read who you follow. Try again.');
    return channels(doc);
  }
  function cancelArm() { clearTimeout(armTimer); armed?.classList.remove('pt-group-remove-armed'); armed = null; }
  function sync() {
    const data = scoped(), group = M.active(data);
    if (label) { label.textContent = group.name; label.title = 'Following group: ' + group.name + ' · click to choose · A new · I edit creators'; }
    const play = document.querySelector('.pt-following-controls .pt-brand');
    if (play) { play.href = url('/feed/subscriptions',group.id); play.title = 'Following feed · ' + group.name; play.setAttribute('aria-label',play.title); }
    if (!manager) return;
    const list = channels(document), included = new Set(M.filter(data,list.map(c => c.id)));
    for (const item of list) {
      item.card.hidden = !included.has(item.id);
      item.card.dataset.followingId = item.id;
      if (!item.card.querySelector('.pt-creator-groups')) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'pt-creator-groups';
        button.textContent = 'Groups'; button.title = 'Group memberships · G';
        button.setAttribute('aria-label','Groups for ' + item.name);
        button.onclick = () => editCreator(item.id,item.name); item.card.append(button);
      }
    }
    const bar = document.querySelector('.pt-following-manager');
    if (bar) {
      bar.querySelector('strong').textContent = group.name + ' · ' + included.size + (included.size === 1 ? ' creator' : ' creators');
      bar.querySelector('button').hidden = group.id === M.ALL;
      bar.querySelector('span').lastChild.textContent = group.id === M.ALL ? ' twice unfollows' : ' twice removes from this group';
    }
    window.ptEmptyGuide?.show('following',included.size === 0);
  }
  function select(id) {
    try {
      const data = read(); if (!data.lists.some(group => group.id === id)) return;
      data.activeId = id; save(data);
      if (manager || feed) location.href = url(manager ? '/subscription_manager' : '/feed/subscriptions',id);
      else sync();
    } catch(error) { report(error.message); }
  }
  function refresh() {
    const data = read();
    if ((manager || feed) && params.get('pt_following') !== data.activeId) { location.href = url(location.pathname,data.activeId); return; }
    sync();
  }
  function makeDialog(title, description) {
    if (dialog?.open) return null;
    const opener = document.activeElement;
    dialog?.remove(); dialog = document.createElement('dialog'); dialog.className = 'pt-following-editor';
    const form = document.createElement('form'), heading = document.createElement('h2'), note = document.createElement('p');
    heading.id = 'pt-following-editor-title'; heading.textContent = title; dialog.setAttribute('aria-labelledby',heading.id);
    note.textContent = description;
    const options = document.createElement('div'); options.className = 'pt-following-options';
    const status = document.createElement('p'); status.setAttribute('role','status');
    const actions = document.createElement('div'); actions.className = 'pt-following-actions';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel'; cancel.onclick = () => dialog.close();
    const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = 'Save';
    actions.append(cancel,submit); form.append(heading,note,options,status,actions); dialog.append(form); document.body.append(dialog);
    dialog.addEventListener('close',() => opener?.isConnected && opener.focus()); dialog.showModal();
    return {form,options,status,submit};
  }
  function checkbox(options, id, name, checked) {
    const row = document.createElement('label'), input = document.createElement('input'); input.type = 'checkbox'; input.value = id; input.checked = checked;
    const text = document.createElement('span'); text.textContent = name; row.append(input,text); options.append(row); return input;
  }
  async function editMembers() {
    let data, group; try { data = scoped(); group = M.active(data); } catch(error) { report(error.message); return; }
    if (group.id === M.ALL) { report('All Creators includes every creator you follow. Use A over the group name to create a group, or I over the person icon to edit your follows.'); return; }
    const ui = makeDialog('Creators in ' + group.name,'Select creators for this feed. A creator can be in several groups. This changes group membership only.'); if (!ui) return;
    ui.submit.disabled = true; ui.status.textContent = 'Reading who you follow…';
    let inputs = [], original = [];
    ui.form.onsubmit = event => {
      event.preventDefault(); if (ui.submit.disabled) return;
      try {
        const latest = read(), current = latest.lists.find(g => g.id === group.id);
        if (!current || JSON.stringify(current.channels) !== JSON.stringify(original)) throw Error('This group changed in another tab. Close and reopen the editor before saving.');
        M.setMembers(latest,group.id,inputs.filter(i => i.checked).map(i => i.value)); save(latest); dialog.close();
        if (feed) location.href = url('/feed/subscriptions',group.id); else sync();
      } catch(error) { ui.status.textContent = error.message; }
    };
    try {
      const list = await followed(); if (!dialog.open) return;
      original = [...group.channels];
      inputs = list.sort((a,b) => a.name.localeCompare(b.name)).map(c => checkbox(ui.options,c.id,c.name,group.channels.includes(c.id)));
      ui.status.textContent = list.length ? 'Space toggles a checkbox. Tab moves between controls. Esc cancels.' : 'Follow a creator first, then add them here.';
      ui.submit.disabled = false;
    } catch(error) { ui.status.textContent = error.message; }
  }
  function editCreator(id,name) {
    let data; try { data = read(); } catch(error) { report(error.message); return; }
    const ui = makeDialog('Groups for ' + name,'Choose every feed this creator belongs to. They always remain in All Creators while you follow them.'); if (!ui) return;
    const groups = data.lists.filter(g => g.id !== M.ALL), inputs = groups.map(g => checkbox(ui.options,g.id,g.name,g.channels.includes(id)));
    const original = JSON.stringify(data.lists);
    if (!groups.length) ui.status.textContent = 'Create a following group with A over the group name first.';
    ui.form.onsubmit = event => {
      event.preventDefault();
      try {
        const latest = read(); if (JSON.stringify(latest.lists) !== original) throw Error('Groups changed in another tab. Close and reopen this editor before saving.');
        for (const input of inputs) { const group = latest.lists.find(g => g.id === input.value); M.setMembers(latest,group.id,input.checked ? [...group.channels,id] : group.channels.filter(c => c !== id)); }
        save(latest); dialog.close(); sync();
      } catch(error) { ui.status.textContent = error.message; }
    };
  }
  // Installed before page handlers so grouped X removes membership, never a follow.
  document.addEventListener('pointermove',event => { pointer = event.target; if (armed && !armed.contains(pointer)) cancelArm(); },{passive:true});
  addEventListener('blur',() => { pointer = null; cancelArm(); });
  document.addEventListener('keydown',event => {
    if (event.key === 'Escape') { cancelArm(); return; }
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.isComposing || event.defaultPrevented || document.querySelector('dialog[open]') || event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')) return;
    const target = event.target.closest('.pt-active-following-group,.pt-subscription') || (pointer?.isConnected ? pointer : document.activeElement);
    const key = event.key.toLowerCase();
    if (key === 'i' && target?.closest('.pt-active-following-group')) { event.preventDefault(); event.stopImmediatePropagation(); editMembers(); return; }
    const card = target?.closest('.pt-subscription');
    if (!card || card.hidden) return;
    const id = card.dataset.followingId;
    if (key === 'g' && id) { event.preventDefault(); event.stopImmediatePropagation(); editCreator(id,card.querySelector('.pt-channel-name')?.textContent || id); return; }
    if (key !== 'x' || !manager) return;
    try {
      const data = scoped(), group = M.active(data); if (group.id === M.ALL) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (armed !== card) { cancelArm(); armed = card; card.classList.add('pt-group-remove-armed'); report('Press X again to remove this creator from ' + group.name + ' · Esc cancels. You will still follow them.'); armTimer = setTimeout(cancelArm,4000); return; }
      M.setMembers(data,group.id,group.channels.filter(c => c !== id)); save(data); cancelArm(); sync(); report('Removed from ' + group.name + '. Still followed in All Creators.');
    } catch(error) { report(error.message); }
  },true);
  window.ptFollowingGroups = {read:scoped,filter:ids => M.filter(scoped(),ids),active:() => M.active(scoped()),editMembers};
  function start() {
    const header = document.querySelector('.pt-header'), follow = header?.querySelector('.pt-follow'), play = header?.querySelector('.pt-brand');
    if (!follow || !play || header.querySelector('.pt-following-controls')) return;
    const controls = document.createElement('div'); controls.className = 'pt-following-controls';
    label = document.createElement('span'); label.className = 'pt-active-following-group';
    follow.before(controls); controls.append(play,label);
    try { sync(); }
    catch(error) { label.textContent = 'Choose group'; report(error.message); }
    window.ptMenuPicker(label,{
        here:feed,menuClass:'pt-following-picker',noun:'following group',nouns:'following groups',menuLabel:'Choose a following group',
        lockedName:'All Creators', locked:id => id === M.ALL, blank:() => ({channels:[]}),read:() => { try { return scoped(); } catch (_) { return read(); } },save:data => { save(data); return true; },refresh,select
      });
    try {
      if (manager) {
        const bar = document.createElement('div'); bar.className = 'pt-following-manager';
        const title = document.createElement('strong'), edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'Edit group creators'; edit.onclick = editMembers;
        const note = document.createElement('span');
        for (const [key,text] of [['I',' over group name · '],['G',' over creator · '],['X',' twice removes from a group']]) { const cap = document.createElement('kbd'); cap.textContent = key; note.append(cap,document.createTextNode(text)); }
        bar.append(title,edit,note);
        const contents = document.querySelector('#contents');
        if (contents.contains(header)) header.after(bar); else contents.prepend(bar);
        sync();
      }
    } catch(error) { report(error.message); }
  }
  addEventListener('storage',event => { if (event.key === M.KEY || event.key === null) { cancelArm(); if (feed) location.reload(); else { try { sync(); } catch(error) { report(error.message); } } } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
