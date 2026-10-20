/* Loaded on every page through Invidious's banner setting (compose.yaml).
   Invidious tells browsers to keep default.css and handlers.js for a month under a
   URL that never changes, so a browser can keep running an old copy of the app's
   look after an update. When that happens (the Pinless layer did not start on this
   page), fetch fresh copies of both files and reload, at most once every 10 minutes. */
(function () {
  'use strict';
  if (location.pathname === '/feed/subscriptions') document.documentElement.classList.add('pt-feed-loading');
  var BUILD = '__INDIVIDUOUS_ASSET_BUILD__';
  var KEY = 'individuous-assets-refresh:' + BUILD;

  function refresh() {
    var css = document.querySelector('link[rel="stylesheet"][href*="/css/default.css"]');
    var js = document.querySelector('script[src*="/js/handlers.js"]');
    if (!css || !js || !window.fetch) return;
    try {
      var last = Number(sessionStorage.getItem(KEY)) || 0;
      if (Date.now() - last < 600000) return; // never loop
      sessionStorage.setItem(KEY, String(Date.now()));
    } catch (e) {
      return; // no session storage: do nothing rather than risk repeated reloads
    }
    var theme = document.querySelector('script[src*="/js/themes.js"]');
    Promise.all([css.href, js.src, '/js/notifications.js', theme && theme.src].filter(Boolean).map(function (url) {
      return fetch(url, { cache: 'reload', credentials: 'same-origin' }).then(function (response) {
        if (!response.ok) throw new Error('Asset refresh failed');
      });
    })).then(function () {
      var video = document.querySelector('video');
      if (!video || video.paused) location.reload();
    }, function () {});
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Runs after every other start-up script on the page.
    setTimeout(function () {
      var cssBuild = getComputedStyle(document.documentElement).getPropertyValue('--individuous-asset-build').replace(/[\"'\s]/g, '');
      var mismatched = BUILD !== '__INDIVIDUOUS_' + 'ASSET_BUILD__' && (window.individuousAssetBuild !== BUILD || cssBuild !== BUILD);
      if (mismatched || window.ptBodyShuffleVersion !== 1 || window.appDataControlsVersion !== 2 || window.pinlessControlsVersion !== 3 || window.individuousBrandVersion !== 1 || window.ptLoopPreferenceVersion !== 1 || window.ptYouTubeConnectionVersion !== 9 || window.ptPlaylistWallVersion !== 1 || window.ptPlaylistBannerVersion !== 1) refresh();
    }, 0);
  });
})();
