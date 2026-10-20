;
/* Autoplay and Loop switches on the video (October 14, 2026), like YouTube's player. They sit left of the
   captions button. Both are saved straight away in the account's preferences (through ptPrefs, site-prefs.js),
   so the Menu page no longer needs player settings:
     Autoplay  -> "Play next by default" + "Autoplay next video": when a video ends, the next one opens and plays
     Loop      -> "Always loop": the video starts over when it ends
   Speed, volume, captions and quality already have buttons on the video and are remembered by the player. */
(function () {
  'use strict';
  if (typeof videojs === 'undefined' || typeof player === 'undefined' || typeof video_data === 'undefined' || !player || !player.controlBar) return;
  player.ready(function () {
    var Button = videojs.getComponent('Button');
    var captions = player.controlBar.getChild('captionsButton');

    var ICONS = {
      autoplay: '<svg viewBox="0 0 38 22" aria-hidden="true"><rect class="pt-sw-track" x="1" y="4" width="36" height="14" rx="7"/>' +
        '<g class="pt-sw-knob"><circle cx="10" cy="11" r="8.5"/><path d="M8 7.3l5 3.7-5 3.7z"/></g></svg>',
      loop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/>' +
        '<path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg>'
    };

    function makeSwitch(kind, label, initial, change) {
      var button = new Button(player, { controlText: label });
      button.addClass('pt-player-switch');
      button.addClass('pt-' + kind);
      player.controlBar.addChild(button);
      if (captions) captions.el().before(button.el());
      var slot = button.el().querySelector('.vjs-icon-placeholder');
      if (slot) slot.innerHTML = ICONS[kind];
      var on = !!initial;
      function show() {
        button.el().setAttribute('aria-pressed', on ? 'true' : 'false');
        button.controlText(label + (on ? ' is on' : ' is off'));
      }
      show();
      if (kind === 'loop') window.addEventListener('pt-prefs-changed', function (event) {
        if (typeof event.detail.video_loop !== 'boolean') return;
        on = event.detail.video_loop;
        player.loop(on);
        show();
      });
      button.on('click', function () {
        on = !on; show();
        change(on, function () { on = !on; show(); });
      });
      return button;
    }

    /* ---- Loop ---- */
    makeSwitch('loop', 'Loop', video_data.params.video_loop, function (on, undo) {
      player.loop(on);
      if (window.ptPrefs) window.ptPrefs.save({ video_loop: on }).catch(function () { player.loop(!on); undo(); });
    });

    /* ---- Autoplay next video ---- */
    var upstreamHandler = !!video_data.play_next;  // watch.js already registered its own 'ended' handler
    function playNext() {
      if (player.loop()) return;
      if (typeof next_video === 'function' && video_data.next_video) next_video();
    }
    makeSwitch('autoplay', 'Autoplay next video', video_data.params['continue'], function (on, undo) {
      if (on) {
        if (!upstreamHandler) { player.off('ended', playNext); player.on('ended', playNext); }
      } else {
        // Drop the page's own "play next" handler as well; this switch decides now.
        player.off('ended');
        upstreamHandler = false;
      }
      if (window.ptPrefs) window.ptPrefs.save({ 'continue': on, continue_autoplay: true }).catch(function () { undo(); });
    });
  });
}());
