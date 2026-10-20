/* External red-strip actions. No media downloading or transcript extraction here. */
;(() => {
  'use strict';
  const KEY = 'pt-external-tools-v1';
  const DEFAULTS = Object.freeze({
    download: 'https://www.ytultra.com/en/youtube-video-downloader/',
    transcript: 'https://www.youtube-transcript.io/videos?id={id}'
  });
  function destination(template, id) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) throw Error('Invalid video.');
    if (typeof template !== 'string' || !template.trim()) throw Error('Set a tool URL in Menu.');
    const expanded = template.trim().replaceAll('{id}', id)
      .replaceAll('{url}', encodeURIComponent('https://www.youtube.com/watch?v=' + id));
    const url = new URL(expanded);
    if (url.protocol !== 'https:' || url.username || url.password || /[{}]/.test(expanded)) {
      throw Error('Use an HTTPS URL with optional {id} or {url}.');
    }
    return url.href;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { destination, DEFAULTS }; return;
  }
  function settings() {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
    catch { return { ...DEFAULTS }; }
  }
  function link(url, text) {
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = text;
    return a;
  }
  function copyFallback(videoURL) {
    const dialog = document.createElement('dialog'); dialog.className = 'pt-external-copy';
    const heading = document.createElement('h2'); heading.textContent = 'Copy the video link';
    const note = document.createElement('p'); note.textContent = 'Paste this link into the downloader you just opened.';
    const input = document.createElement('input'); input.readOnly = true; input.value = videoURL;
    input.setAttribute('aria-label', 'YouTube video URL'); input.addEventListener('focus', () => input.select());
    const close = document.createElement('button'); close.textContent = 'Close'; close.type = 'button';
    close.onclick = () => dialog.close(); dialog.addEventListener('close', () => dialog.remove());
    dialog.append(heading, note, input, close); document.body.append(dialog); dialog.showModal(); input.focus(); input.select();
  }
  window.ptExternalTools = {
    open(id, transcript, report) {
      try {
        const template = settings()[transcript ? 'transcript' : 'download'];
        const url = destination(template, id);
        const videoURL = 'https://www.youtube.com/watch?v=' + id;
        // Start clipboard access during the user's click, before the new tab takes focus.
        const needsPaste = !transcript && !/\{(?:id|url)\}/.test(template);
        const copying = needsPaste ? (navigator.clipboard?.writeText(videoURL) || Promise.reject(Error('Clipboard unavailable'))) : null;
        // Catch immediately, including when the browser denies clipboard access.
        const copied = copying?.then(() => true, () => false);
        const a = link(url, ''); document.body.append(a); a.click(); a.remove();
        if (copied) copied.then(ok => {
          report(ok ? 'Video link copied — paste into YTUltra.' : 'Copy the video link into the downloader.');
          if (!ok) copyFallback(videoURL);
        });
        else report(transcript ? 'Transcript tool opened.' : 'Downloader opened.');
      } catch (error) { report(error.message); }
    }
  };
  function mount() {
    if (new URLSearchParams(location.search).get('pt_page') !== 'menu') return;
    const main = document.querySelector('.pt-navigation-page');
    if (!main || document.getElementById('pt-external-tools')) return;
    const section = document.createElement('section'); section.id = 'pt-external-tools'; section.className = 'pt-guide pt-external-settings';
    const heading = document.createElement('h2'); heading.textContent = 'Downloads & transcripts';
    const note = document.createElement('p');
    note.textContent = 'Click the red strip to copy the video link and open YTUltra, then paste it there. Ctrl-click (⌘-click on Mac) opens the transcript for that video. These tools open in a new tab.';
    const form = document.createElement('form'); const values = settings(); const inputs = {};
    for (const [kind, title] of [['download', 'Downloader URL'], ['transcript', 'Transcript URL']]) {
      const label = document.createElement('label'); label.textContent = title;
      const input = document.createElement('input'); input.type = 'text'; input.value = values[kind];
      input.name = kind; input.required = true; input.spellcheck = false;
      label.append(input); form.append(label); inputs[kind] = input;
    }
    const hint = document.createElement('p'); hint.textContent = 'Optional: {id} inserts the video ID; {url} inserts its encoded YouTube URL. A plain downloader URL uses copy and paste.';
    const save = document.createElement('button'); save.type = 'submit'; save.textContent = 'Save tool URLs';
    const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = 'Use defaults';
    const status = document.createElement('p'); status.setAttribute('role', 'status');
    form.onsubmit = event => {
      event.preventDefault();
      try {
        const next = {};
        for (const kind of ['download', 'transcript']) {
          destination(inputs[kind].value, 'AS92HYsEBqo'); next[kind] = inputs[kind].value.trim();
        }
        localStorage.setItem(KEY, JSON.stringify(next)); status.textContent = 'Tool URLs saved.';
      } catch (error) { status.textContent = error.message; }
    };
    reset.onclick = () => { for (const kind of ['download', 'transcript']) inputs[kind].value = DEFAULTS[kind]; form.requestSubmit(); };
    form.append(hint, save, reset, status); section.append(heading, note, form); main.append(section);
  }
  const observer = new MutationObserver(mount); observer.observe(document.documentElement, {childList: true, subtree: true});
  if (document.readyState !== 'loading') mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
