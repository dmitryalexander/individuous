/* Following editor (October 15, 2026). Point the mouse at the person (Subscriptions) button in the top bar and press I:
   a box opens, like the Recommended searches editor, filled with everyone you follow, one channel per line.
   Delete a line to unfollow that channel, type or paste new lines (a YouTube link, an @handle or a channel ID) to
   follow more, then Save. The box holds the whole list, so saving makes your follow list match it exactly.
   Anything after " #" on a line is only a note (the box writes the channel's name there). On the Manage
   subscriptions page, I works anywhere except over the search terms. Nothing is changed until Save, and the box
   refuses to open (and so can never save an empty list by mistake) if your follow list could not be read. */
;(() => {
  'use strict';
  const channelID = /^UC[\w-]{22}$/;
  let dialog, form, editor, count, errorBox, saveButton, cancelButton;
  let busy = false, opener = null, known = new Set();

  function parse(line) {
    if (channelID.test(line)) return {id:line};
    if (/^@[^\s/?#]+$/.test(line)) return {path:'/' + line};
    let url;
    try { url = new URL(line.startsWith('/') ? line : /^https?:\/\//i.test(line) ? line : 'https://' + line, location.origin); }
    catch (_) { throw Error('Invalid channel: ' + line); }
    if (!['http:', 'https:'].includes(url.protocol) || !(url.origin === location.origin || /^(www\.|m\.)?youtube\.com$/i.test(url.hostname))) throw Error('Use a YouTube channel URL, @handle, or channel ID: ' + line);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'channel' && channelID.test(parts[1] || '')) return {id:parts[1]};
    if (/^@[^\s]+$/.test(parts[0] || '')) return {path:'/' + parts[0]};
    if (['c','user'].includes(parts[0]) && parts[1]) return {path:'/' + parts.slice(0,2).join('/')};
    throw Error('Not a channel URL: ' + line);
  }
  // One channel per line; blank lines, whole-line notes and " # notes" after a channel are dropped; duplicates too.
  function linesOf(text) {
    return [...new Set(text.split(/\r?\n/).map(line => line.replace(/\s+#.*$/, '').trim()).filter(line => line && !line.startsWith('#')))];
  }
  async function getPage(path) {
    const response = await fetch(path, {credentials:'same-origin', cache:'no-store', signal:AbortSignal.timeout(30000)});
    if (!response.ok || new URL(response.url).pathname === '/login') throw Error('Could not read channel/account data. Check your connection and sign-in, then retry.');
    return {response, doc:new DOMParser().parseFromString(await response.text(), 'text/html')};
  }
  const tokenFrom = doc => doc.querySelector('form[action^="/subscription_ajax"] input[name="csrf_token"]')?.value;
  function channelsIn(doc) {
    return [...doc.querySelectorAll('form[action^="/subscription_ajax"]')].map(f => {
      const id = new URL(f.getAttribute('action'), location.origin).searchParams.get('c');
      const name = (f.closest('.pure-g')?.parentElement?.querySelector('a[href^="/channel/"]')?.textContent || '').replace(/\s+/g, ' ').trim();
      return channelID.test(id || '') ? {id, name} : null;
    }).filter(Boolean);
  }

  function updateCount() {
    if (!editor) return;
    const lines = linesOf(editor.value);
    let kept = 0;
    lines.forEach(line => { try { const e = parse(line); if (e.id && known.has(e.id)) kept++; } catch (_) {} });
    const fresh = lines.length - kept, removed = known.size - kept;
    count.textContent = lines.length + ' channel' + (lines.length === 1 ? '' : 's') + (fresh ? ' · ' + fresh + ' to follow' : '') + (removed ? ' · ' + removed + ' will be unfollowed' : '') + ' · Blank lines, duplicates and # notes are removed on save.';
    count.classList.toggle('pt-sub-warn', removed > 0);
  }

  function build() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.className = 'pt-interest-editor pt-subscription-import';
    dialog.setAttribute('aria-labelledby', 'pt-sub-editor-title');
    dialog.innerHTML = '<form><h2 id="pt-sub-editor-title">Following</h2><p>Add, edit or remove channels below, one per line: a YouTube link, an @handle or a channel ID. Delete a line to unfollow that channel. Anything after “ #” on a line is just a note. Saved in this app.</p><label for="pt-sub-list">Channels</label><textarea id="pt-sub-list" spellcheck="false"></textarea><p class="pt-interest-count" aria-live="polite"></p><p class="pt-interest-error" role="alert" hidden></p><div class="pt-interest-editor-actions"><span></span><button type="button" class="pt-interest-cancel">Cancel</button><button type="submit" class="pt-interest-save">Save</button></div></form>';
    document.body.append(dialog);
    form = dialog.querySelector('form'); editor = dialog.querySelector('textarea');
    count = dialog.querySelector('.pt-interest-count'); errorBox = dialog.querySelector('.pt-interest-error');
    saveButton = dialog.querySelector('.pt-interest-save'); cancelButton = dialog.querySelector('.pt-interest-cancel');
    cancelButton.addEventListener('click', () => { if (!busy) dialog.close(); });
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    dialog.addEventListener('close', () => { if (opener && opener.isConnected) opener.focus?.(); });
    editor.addEventListener('input', updateCount);
    form.addEventListener('submit', save);
  }

  async function openEditor(trigger) {
    if (busy || dialog?.open) return;
    opener = trigger;
    build();
    errorBox.hidden = true; saveButton.disabled = true; editor.disabled = true;
    editor.value = ''; known = new Set(); count.textContent = 'Reading who you follow…';
    dialog.showModal();
    try {
      const page = await getPage('/subscription_manager');
      const list = channelsIn(page.doc).sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
      known = new Set(list.map(c => c.id));
      editor.value = list.length ? list.map(c => c.id + (c.name ? ' # ' + c.name : '')).join('\n') + '\n' : '';
      editor.disabled = false; saveButton.disabled = false;
      updateCount();
      editor.focus();
      editor.setSelectionRange(editor.value.length, editor.value.length);
      editor.scrollTop = editor.scrollHeight;
    } catch (error) {
      // Never offer an empty box that could replace the real list.
      count.textContent = '';
      errorBox.textContent = error.message; errorBox.hidden = false;
    }
  }

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    let added = 0, removed = 0;
    busy = true; errorBox.hidden = true;
    const controls = [...form.querySelectorAll('button,textarea')];
    controls.forEach(control => { control.disabled = true; });
    try {
      const lines = linesOf(editor.value);
      if (!lines.length) throw Error('Keep at least one channel. To unfollow everyone, unfollow them on the Manage subscriptions page.');
      const entries = lines.map(parse); // Validate every line before changing anything.
      count.classList.remove('pt-sub-warn'); count.textContent = 'Checking channels…';
      const current = await getPage('/subscription_manager');
      const existing = new Set(channelsIn(current.doc).map(c => c.id));
      let token = tokenFrom(current.doc);
      const wanted = new Set();
      for (const entry of entries) {
        if (entry.id) { wanted.add(entry.id); continue; }
        const result = await getPage(entry.path);
        const id = new URL(result.response.url).pathname.split('/')[2];
        if (!channelID.test(id || '')) throw Error('Could not resolve channel ' + entry.path);
        wanted.add(id); token ||= tokenFrom(result.doc);
      }
      if (!token) token = tokenFrom((await getPage('/channel/' + [...wanted][0])).doc);
      if (!token) throw Error('Please sign in again before saving your follow list.');
      async function change(id, action) {
        const response = await fetch('/subscription_ajax?' + new URLSearchParams({action, c:id, redirect:'false'}), {
          method:'POST', credentials:'same-origin', body:new URLSearchParams({csrf_token:token}), signal:AbortSignal.timeout(30000)
        });
        if (!response.ok) throw Error('Could not update channel ' + id + '. Please retry.');
        const result = await response.json();
        if (result.error) throw Error(String(result.error));
      }
      // Only unfollow after every requested addition succeeded.
      for (const id of wanted) if (!existing.has(id)) {
        count.textContent = 'Following… ' + added;
        await change(id, 'create_subscription_to_channel'); added++;
      }
      for (const id of existing) if (!wanted.has(id)) {
        count.textContent = 'Unfollowing… ' + removed;
        await change(id, 'remove_subscriptions'); removed++;
      }
      count.textContent = 'Saved. Reloading…';
      location.reload();
    } catch (error) {
      errorBox.textContent = (added || removed ? 'Saved so far: ' + added + ' followed, ' + removed + ' unfollowed. ' : '') + error.message;
      errorBox.hidden = false; updateCount();
    } finally {
      busy = false;
      controls.forEach(control => { control.disabled = false; });
    }
  }

  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.isComposing || event.key.toLowerCase() !== 'i') return;
    if (document.querySelector('dialog[open],.pt-interest-bar:hover') || event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')) return;
    const follow = document.querySelector('.pt-follow');
    const overFollow = !!follow && (follow.matches(':hover') || document.activeElement === follow);
    if (!overFollow && location.pathname !== '/subscription_manager') return;
    event.preventDefault(); event.stopImmediatePropagation();
    openEditor(follow || document.body);
  }, true);

  // Tell people about the key where they will look for it.
  function hint() {
    const follow = document.querySelector('.pt-follow');
    if (follow) follow.title = 'Subscriptions · point here and press I to edit who you follow';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hint, {once:true}); else hint();
  addEventListener('load', hint, {once:true});
})();
