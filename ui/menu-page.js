;
/* Menu page (October 14, 2026). This replaces account-settings.js: the long Invidious preferences form
   (player, visual, subscription and account settings) is gone. The Menu page now has
     - a row of round icon switches: Privacy mode (sunglasses), Loop video, Watch history, Hover previews, Hidden videos
     - the boxed tutorial sections (search-tags.js, hotkeys-guide.js)
   ("Your data" is gone, October 15, 2026: Clear hidden videos is Ctrl+Shift+X twice in the Hidden videos list, Clear watch
   history is Ctrl+Shift+X twice on the History page, and the follow list is edited with I over the person button.)
   Privacy mode, Loop video and Watch history are Invidious's own preferences ("Search privacy", "Always loop",
   "Enable watch history"), read and saved through ptPrefs (site-prefs.js). Loop video is the same setting as the
   Loop button on the video player. */
(function () {
  'use strict';
  if (new URLSearchParams(location.search).get('pt_page') !== 'menu') return;
  var SHAPES = {
    // Sunglasses: two dark lenses, a bridge and the arms.
    privacy: '<path d="M2.5 8.5v3.8a3.6 3.6 0 0 0 3.6 3.6h.8a3.6 3.6 0 0 0 3.6-3.6V8.5z" fill="white" fill-opacity=".9"/>' +
      '<path d="M13.5 8.5v3.8a3.6 3.6 0 0 0 3.6 3.6h.8a3.6 3.6 0 0 0 3.6-3.6V8.5z" fill="white" fill-opacity=".9"/>' +
      '<path d="M10.5 10q1.5-1.4 3 0M2.5 8.5 1.5 6M21.5 8.5 22.5 6"/>',
    preview: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    hidden: '<path d="m3 3 18 18M2 12s4-7 10-7c6 0 10 7 10 7s-4 7-10 7S2 12 2 12Z"/>',
    // Two arrows chasing each other (the same shape as the Loop button on the video).
    loop: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    // A clock with a counter-clockwise arrow.
    history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5M3.5 4v4.5H8"/><path d="M12 7.5V12l3 2"/>'
  };
  function iconUrl(kind) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + SHAPES[kind] + '</svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }
  function setIcon(item, kind) {
    item.dataset.accountIcon = kind;
    item.style.setProperty('--account-icon', iconUrl(kind));
  }

  /* ---------- Round icon row ---------- */
  function pressed(item, on) { item.setAttribute('aria-pressed', on ? 'true' : 'false'); }

  /* A round on/off switch that mirrors one saved Invidious preference. */
  function prefSwitch(cfg) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'pt-menu-item ' + cfg.cls;
    button.title = cfg.title;
    setIcon(button, cfg.icon);
    var on = false, ready = false, busy = false;
    function show(note) { button.textContent = note || (cfg.label + ': ' + (on ? 'on' : 'off')); pressed(button, on); }
    if (cfg.pref === 'video_loop') window.addEventListener('pt-prefs-changed', function (event) {
      if (typeof event.detail.video_loop !== 'boolean') return;
      on = event.detail.video_loop; show();
    });
    button.textContent = cfg.label;
    if (window.ptPrefs) {
      window.ptPrefs.read([cfg.pref]).then(function (values) {
        if (values[cfg.pref] === null) { show(cfg.label + ' unavailable'); return; }
        on = !!values[cfg.pref]; ready = true; show();
      }, function () { show(cfg.label + ' unavailable'); });
    } else show(cfg.label + ' unavailable');
    button.addEventListener('click', function () {
      if (!ready || busy || !window.ptPrefs) return;
      busy = true; on = !on; show();
      var change = {}; change[cfg.pref] = on;
      window.ptPrefs.save(change).then(function () { busy = false; }, function () {
        busy = false; on = !on; show('Could not save. Try again.');
      });
    });
    return button;
  }
  function menuSwitches() {
    return [
      prefSwitch({ pref: 'search_privacy', label: 'Privacy mode', cls: 'pt-privacy-switch', icon: 'privacy',
        title: 'Privacy mode: searches are not saved in your browser history.' }),
      prefSwitch({ pref: 'video_loop', label: 'Loop video', cls: 'pt-loop-switch', icon: 'loop',
        title: 'Loop video: a video you play starts over when it ends. Same switch as the Loop button on the video.' }),
      prefSwitch({ pref: 'watch_history', label: 'Watch history', cls: 'pt-history-switch', icon: 'history',
        title: 'Watch history: when off, videos you watch are not added to History. What is already there stays.' })
    ];
  }

  function tidyPanel(panel) {
    panel.querySelectorAll('.pt-menu-note, .pt-menu-form').forEach(function (node) { node.remove(); });
    Array.prototype.slice.call(panel.querySelectorAll('.pt-menu-item')).forEach(function (item) {
      var text = (item.textContent || item.value || '').trim().toLowerCase();
      var kind = item.classList.contains('pt-preview-switch') ? 'preview' : text.indexOf('hidden videos') === 0 ? 'hidden' : '';
      if (!kind) { item.remove(); return; }
      setIcon(item, kind);
      if (kind === 'preview') {
        // pinless-look.js writes "Hover previews: on/off" into the button; mirror it in aria-pressed.
        var sync = function () { pressed(item, /:\s*on\s*$/i.test(item.textContent)); };
        sync();
        new MutationObserver(sync).observe(item, { childList: true, characterData: true, subtree: true });
      }
    });
    panel.prepend.apply(panel, menuSwitches());
  }

  /* ---------- Mount ---------- */
  var mounted = false;
  function mount() {
    if (mounted) return true;
    var main = document.querySelector('.pt-navigation-page');
    var panel = main && main.querySelector('.quiet-menu-panel');
    var shell = main && main.querySelector('.pt-page-panel');
    // pinless-look.js builds the panel (with the Hover previews and Hidden videos buttons) before it moves it here.
    if (!panel || !shell) return false;
    mounted = true;
    main.classList.add('pt-account-page', 'pt-menu-page');
    tidyPanel(panel);
    // Hidden videos can arrive after the first pass.
    new MutationObserver(function () {
      panel.querySelectorAll('.pt-menu-item').forEach(function (item) {
        if (item.dataset.accountIcon) return;
        var text = (item.textContent || '').trim().toLowerCase();
        if (text.indexOf('hidden videos') === 0) setIcon(item, 'hidden'); else item.remove();
      });
    }).observe(panel, { childList: true });
    return true;
  }
  var observer = new MutationObserver(function () { if (mount()) observer.disconnect(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState !== 'loading') mount();
  else document.addEventListener('DOMContentLoaded', mount);
}());
