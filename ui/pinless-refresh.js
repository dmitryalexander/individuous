/* Loaded on every page through Invidious's banner setting (compose.yaml).
   Invidious tells browsers to keep default.css and handlers.js for a month under a
   URL that never changes, so a browser can keep running an old copy of the app's
   look after an update. When that happens (the Pinless layer did not start on this
   page), fetch fresh copies of both files and reload, at most once every 10 minutes. */
(function () {
  'use strict';
  if (location.pathname === '/feed/subscriptions') document.documentElement.classList.add('pt-feed-loading');
  var BUILD = '__INDIVIDUOUS_ASSET_BUILD__';
  var KEY = 'individuous-assets-refresh:';
  var reloading = false;

  function refresh(build) {
    build = build || BUILD;
    if (reloading) return;
    var fallback = false;
    var css = document.querySelector('link[rel="stylesheet"][href*="/css/default.css"]');
    var js = document.querySelector('script[src*="/js/handlers.js"]');
    if (!css || !js || !window.fetch) return;
    try {
      var last = Number(sessionStorage.getItem(KEY + build)) || 0;
      if (Date.now() - last < 600000) return; // never loop
      sessionStorage.setItem(KEY + build, String(Date.now()));
    } catch (e) {
      fallback = true;
      if (new URL(location.href).searchParams.get('_pt_assets') === build) return;
    }
    reloading = true;
    // Page-specific player scripts and artwork can change independently of handlers.js.
    var urls = [css.href, js.src];
    document.querySelectorAll('script[src],link[rel="stylesheet"],img[src]').forEach(function (node) {
      var url = new URL(node.src || node.href, location.href);
      if (url.origin === location.origin && (/^\/(js|css)\//.test(url.pathname) || /^\/[\w-]+\.(png|svg|ico)$/.test(url.pathname))) urls.push(url.href);
    });
    Promise.all(Array.from(new Set(urls)).map(function (url) {
      return fetch(url, { cache: 'reload', credentials: 'same-origin' }).then(function (response) {
        if (!response.ok) throw new Error('Asset refresh failed');
      });
    })).then(function () {
      var video = document.querySelector('video');
      if (video && !video.paused) { reloading = false; return; }
      if (fallback) {
        var next = new URL(location.href); next.searchParams.set('_pt_assets', build);
        location.replace(next.href);
      } else location.reload();
    }, function () { reloading = false; });
  }

  // Back/Forward can restore an entire old document without requesting its assets.
  addEventListener('pageshow', function (event) {
    if (!event.persisted || !window.fetch) return;
    fetch('/js/pinless-refresh.js', {cache: 'no-store', credentials: 'same-origin'})
      .then(function (response) { return response.ok ? response.text() : ''; })
      .then(function (text) {
        var latest = (text.match(/var BUILD = '([a-f0-9]{64})'/) || [])[1];
        if (latest && latest !== BUILD) refresh(latest);
      }).catch(function () {});
  });

  document.addEventListener('DOMContentLoaded', function () {
    // Runs after every other start-up script on the page.
    setTimeout(function () {
      var cssBuild = getComputedStyle(document.documentElement).getPropertyValue('--individuous-asset-build').replace(/[\"'\s]/g, '');
      var mismatched = BUILD !== '__INDIVIDUOUS_' + 'ASSET_BUILD__' && (window.individuousAssetBuild !== BUILD || cssBuild !== BUILD);
      if (mismatched || window.ptBodyShuffleVersion !== 1 || window.appDataControlsVersion !== 2 || window.pinlessControlsVersion !== 3 || window.individuousBrandVersion !== 1 || window.ptLoopPreferenceVersion !== 1 || window.ptYouTubeConnectionVersion !== 9 || window.ptPlaylistWallVersion !== 1 || window.ptPlaylistBannerVersion !== 1) refresh(BUILD);
    }, 0);
  });
})();
