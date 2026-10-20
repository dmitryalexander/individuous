;
/* Site preferences helper (October 14, 2026). The Menu page no longer shows Invidious's long preferences
   form, but a few switches (privacy mode, autoplay, loop) still live in the account's saved preferences.
   window.ptPrefs reads and changes them without the form on screen:
     ptPrefs.read(['search_privacy'])            -> Promise of {search_privacy: true/false}
     ptPrefs.save({video_loop: true})            -> Promise; true = checked, false = unchecked, text = that value
   Saving loads the current preferences form, changes only the named fields and sends the whole form back, so
   every other preference keeps its value. Saves run one at a time so two quick clicks never overwrite each other. */
(function () {
  'use strict';
  if (window.ptPrefs) return;
  window.ptLoopPreferenceVersion = 1;
  var REFERER = '/feed/subscriptions?pt_page=menu';
  var URL_ = '/preferences?referer=' + encodeURIComponent(REFERER);
  var LOOP_CHANGE = 'pt-loop-preference-change';
  function loopChanged(on) {
    window.dispatchEvent(new CustomEvent('pt-prefs-changed', { detail: { video_loop: on } }));
  }
  window.addEventListener('storage', function (event) {
    if (event.key !== LOOP_CHANGE || !event.newValue) return;
    try {
      var change = JSON.parse(event.newValue);
      if (typeof change.video_loop === 'boolean') loopChanged(change.video_loop);
    } catch (_) {}
  });
  function load() {
    return fetch(URL_, { credentials: 'same-origin', cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('Preferences unavailable');
      return response.text();
    }).then(function (html) {
      var form = new DOMParser().parseFromString(html, 'text/html').querySelector('form[action^="/preferences"]');
      if (!form) throw new Error('Preferences unavailable');
      return form;
    });
  }
  var chain = Promise.resolve();
  window.ptPrefs = {
    read: function (names) {
      return load().then(function (form) {
        var out = {};
        names.forEach(function (name) {
          var field = form.elements[name];
          out[name] = !field ? null : field.type === 'checkbox' ? field.checked : field.value;
        });
        return out;
      });
    },
    save: function (changes) {
      var run = function () {
        return load().then(function (form) {
          var data = new FormData(form);
          Object.keys(changes).forEach(function (name) {
            var value = changes[name];
            if (value === true) data.set(name, 'on');
            else if (value === false) data.delete(name);
            else data.set(name, String(value));
          });
          return fetch(URL_, { method: 'POST', body: new URLSearchParams(data), credentials: 'same-origin', redirect: 'manual' });
        }).then(function (response) {
          // The server answers a saved form with a redirect.
          if (response.type !== 'opaqueredirect' && !response.ok) throw new Error('Could not save');
          if (typeof changes.video_loop === 'boolean') {
            loopChanged(changes.video_loop);
            try { localStorage.setItem(LOOP_CHANGE, JSON.stringify({ video_loop: changes.video_loop, at: Date.now() })); } catch (_) {}
          }
        });
      };
      var result = chain.then(run, run);
      chain = result.catch(function () {});
      return result;
    }
  };
}());
