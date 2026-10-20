/* Product name; upstream references and saved-data keys remain compatible. */
(function () {
  'use strict';
  window.individuousBrandVersion = 1;
  function updateTitle() {
    const title = document.title.replace(/\s*[-·|]\s*(?:Invidious|YouTube|individuous)\s*$/i, '').trim();
    const branded = !title || /^(?:Invidious|YouTube|individuous)$/i.test(title)
      ? 'individuous' : title + ' · individuous';
    if (document.title !== branded) document.title = branded;
  }
  function start() {
    updateTitle();
    new MutationObserver(updateTitle).observe(document.querySelector('head'), {
      childList: true, subtree: true, characterData: true
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
