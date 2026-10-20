Historical preview baseline; current fixes and verification are in RELEASE_NOTES.md and RELEASE_VERIFICATION.md. The collection overwrite finding is resolved by per-item revisions and explicit conflict handling.

# Isolated preview verification

Verified October 19, 2026. This is a working local development baseline, not a
published release. No GitHub push or publishing remote was created.

## Passed

- Complete Invidious source checked out at
  `48c6110a83fc788b4199daf737279b71950cc0db`; local source Docker build succeeds.
  Windows checkout line endings initially broke an ECR template; the clean tree
  now uses LF rules for text and shell files.
- Fresh generated configuration, one automatically created local account, its
  subscription materialized view, and an idempotent bootstrap. The companion's
  exact 16-character alphanumeric key requirement is handled by setup.
- Separate `individuous-preview` containers, network and four new volumes. Only
  `127.0.0.1:3013` is published. No installed container names or external volumes.
- New database initially contained zero follows and zero watch-history entries;
  app-data initially empty and YouTube connection absent.
- Browser: Menu, local account preferences, loop on/off with reload persistence,
  saving provider URLs, live search, real video playback advancing to at least
  00:09 of a 09:18 video, saving a search result into Watch Later, and removal.
- Browser: temporary playlist persisted across a complete preview stop/start.
  Removed the temporary playlist, saved video and watch-history entry afterwards.
- Browser: normal click on the main player's red strip copies its video URL and
  opens YTUltra; Ctrl-click opens the selected video's transcript URL. Pure tests
  also verify URL substitution, invalid-provider rejection and the exact copied URL.
- 3 Node external-tool tests; all UI JavaScript syntax checks.
- 7 YouTube account-service tests in a preview-only container, using synthetic
  HTTP/accounts and temporary files. Added writable temporary storage to read-only
  helper services so these tests and runtime temporary operations can work.
- 2 saved-data HTTP/restart tests in a disposable Python container with networking
  disabled except loopback. Persistence, merge behavior, deletion markers,
  invalid-payload rejection and installed-origin rejection all pass. Tests bypass
  host HTTP proxy settings for loopback requests.
- PowerShell setup regression check: fresh keys have valid formats; a second
  setup invocation preserves existing `.env` exactly.
- `.env` is ignored by Git and excluded from Docker build inputs. Installed source
  hashes were compared with the pre-extraction snapshot and remained unchanged.

## External tools

YTUltra left its input empty during a tested `?url=` navigation. The implementation
therefore copies the video URL and opens its normal page; paste is required there.
Browser origin restrictions prevent this app from writing directly into another
site's form. If the clipboard is unavailable, a selectable-link dialog is provided.

The transcript site's `videos?id=...` link starts loading the selected video, then
asks signed-out visitors to log in, with an anonymous-login option. No transcript
account was created and transcript extraction itself was not verified.

There is no local download service in this preview. Individuous's playback and
hover previews still stream media; red-strip actions delegate to external tools.

## Remaining before public release

- Live YouTube personal-feed authentication remains owner-side and unverified in
  this fresh installation. No installed session was imported.
- Recheck real upstream playlist queues, creator-feed ordering and broader live
  compatibility; these were not comprehensively verified by the baseline smoke tests.
- The previous installed playlist overwrite was not reproduced or diagnosed here.
  Current tests establish basic save/restart behavior, not conflict safety across
  multiple browsers with stale pending edits. Audit that sync behavior before a
  public release.
- Update the interface/design with the owner, then perform final provenance,
  artifact/privacy and clean-checkout CI checks before publishing. Upstream
  publishing and scheduled workflows are archived under `.github/upstream-workflows`
  with `.disabled` extensions so they will not run for this fork.
- First source compilation is relatively slow. The build retains upstream's
  compiler/OpenSSL process and required Git metadata; later UI builds reuse layers.
- External providers and YouTube's undocumented APIs can change independently.

Browser evidence is kept outside distributable source in `release-prep/probes`.

## October 19 — Empty-page welcome tutorials

Added contextual tutorials to empty Playlists, Search Groups and Subscriptions
walls. Two owner-reference character poses were created with built-in imagegen as
transparent PNGs; transparent corner alpha was verified. Tutorial copy and amber
square keyboard caps are live HTML, with responsive layout rules. Source assets
and exact generation prompts are recorded in TUTORIAL_ARTWORK.txt.

Verified in the actual preview browser: all three page variants, transparent art
on the dark page, real playlist picker/rename control, real search-group picker,
normal search results, guidance absent with a saved video and returning after
that video is removed. The temporary video was removed; no existing collections,
follows or settings were changed. Relevant JavaScript syntax checks and the three
external-tool regressions passed. Rebuilt/deployed only individuous-preview's main
container. Installed source hashes remained unchanged.

Screenshots: individuous-tutorial-playlists.png,
individuous-tutorial-search-groups.png, individuous-tutorial-subscriptions.png in
the external probes folder. Mobile rules are included but separate device/browser
coverage is still pending.


## October 19 — Menu keycaps and distinct empty-page poses

Menu now explicitly explains Ctrl-click on the main video area opens YouTube,
while red/blue strips retain their transcript/new-tab actions. All inline Menu
shortcuts receive amber framed keyboard caps; Menu has no character.

Added six built-in imagegen transparent poses for History, Hidden, Following,
Search terms, zero-result search and personal YouTube feed. Search Groups keeps
its separate cross-legged thinker. Restored the existing search-term-manager URL
as a static page with its required status element. Additional exact prompts and
asset paths are in TUTORIAL_ARTWORK_ADDITIONAL.txt.

Browser verified all six new empty views, named Enter cap sizing, Menu layout,
and A opening the terms dialog (cancelled without saving). Connection status
remains visible on the personal feed. Five Node tests and all UI JS syntax checks
passed. Preview-only Docker source build/deployment succeeded; installed source
hashes unchanged. Screenshots are under the external probes folder.

## 2026-10-19 — Restore Feed tutorial, clean preview

Added a dedicated Restore Feed empty-state guide and transparent kneeling, looking-back beckoning character. Copy explains tab-local wall/scroll restoration, the diamond control, starting a search and saving videos with A. Amber keycaps match other guides. Empty restore routes use this guide instead of the underlying feed guide; populated walls keep their content. Built-in imagegen asset/prompt recorded in TUTORIAL_ARTWORK_RESTORE.txt. Changes and deployment limited to release-prep/individuous on port 3013.

## 2026-10-19 — Simpler chibi artwork revisions

Replaced the Restore Feed and subscription-manager poses with compact standing chibi figures using History as the style reference. Restore looks around with an amber question mark; Following stands naturally with arms at his sides. History image hash remains 759e95bbec0fbd2c0a11389cf2f5474399f5430c43a5a60a5ffdf522e83298ad. New versioned assets tutorial-restore-v2.png and tutorial-following-v2.png avoid cached old poses. Built-in imagegen prompts and transparent-background cleanup recorded in TUTORIAL_ARTWORK_REVISIONS.txt. Preview-only deployment; installed source/configuration baseline remains unchanged. JavaScript syntax and PNG alpha checked.

## 2026-10-19 — Match supplied character references

Owner rejected the oversized-head v2 poses. Generated v3 Restore and Following assets using the owner's newly attached standing character screenshots directly as strict references, matching their sketchy lines, muted tones, shirt/jeans texture and longer body proportions. Restore stands looking around with an amber question mark; Following stands casually with one hand in a pocket. History and all accepted artwork unchanged. Built-in imagegen prompts/asset paths in TUTORIAL_ARTWORK_REFERENCE_MATCH.txt. Preview-only source build, alpha/syntax checks and installed baseline verification completed. No installed app/data changes.

## 2026-10-19 — Requested arm pose edits

Edited the accepted v3 images with built-in imagegen: Restore now has folded arms while retaining the puzzled face/question mark; Following has both hands in his jeans pockets. New versioned v4 transparent PNG assets, prompts in TUTORIAL_ARTWORK_ARM_EDITS.txt. Other artwork/copy unchanged. Preview-only source build/deployment and JavaScript syntax check completed; no installed app/data changes.

## 2026-10-19 — Subscription manager creator-award artwork

Owner requested a gold play-button trophy to convey creators/following. Edited the accepted character to hold a gold play-button plaque in both hands, preserving the standing proportions and sketchy style. Asset ui/tutorial-following-trophy.png, built-in imagegen prompt in TUTORIAL_ARTWORK_TROPHY.txt. Only subscription-manager artwork changed; clean preview source build/deployment and JS syntax check completed. No installed app/data changes.

## 2026-10-19 — Restore Feed confused-meme parody

Owner requested the supplied confused looking-around meme as a pose reference while keeping his character. Built-in imagegen produced ui/tutorial-restore-meme.png: same sketchy boy/gray shirt/jeans, sideways puzzled glance, palm-up hand, carried taupe jacket and blank slip. Exact prompt/reference roles in TUTORIAL_ARTWORK_RESTORE_MEME.txt. Restore artwork only; copy/other poses unchanged. Preview-only source build/deployment and JS syntax check completed. No installed app/data changes.

## 2026-10-19 — Subscription manager trophy gaze

Owner requested the character look down at his gold play-button award. Edited the existing trophy artwork with built-in imagegen, tilting his head and directing his gaze down while preserving the pose/style. New asset ui/tutorial-following-trophy-down.png; exact prompt in TUTORIAL_ARTWORK_TROPHY_GAZE.txt. Preview-only build/deployment and JS syntax check; installed app/data unchanged.

## October 19 — Following groups

Added named Following groups in the isolated preview. The play button now sits
at the top right beside the group rectangle and Following icon. All following is
reserved/dynamic; a creator can belong to multiple custom groups. Shared picker
uses A / R / X twice, arrows / Enter / Esc. I over the group name edits creator
checkboxes; G over a Following card or its Groups button edits memberships.
Within a named group, X twice removes only membership; in All following the
existing two-press unfollow remains. Menu/empty-page guidance and amber caps updated.

pt-following-groups-v1 hydrates/mirrors through app-data. Explicit group IDs scope
feed URLs, and restored subscription walls include a group/membership signature
to prevent replaying another group's cached results. Invalid group data is kept
and reported rather than reset. Existing follows and playlist saving are separate.

Validation: 6 group model/hydration tests plus the existing 5 Node checks passed;
all UI JavaScript parses. Two real saved-data HTTP/restart tests passed in a
network-isolated disposable Python container, including a group fixture. Windows
sandbox blocked host test sockets, so the supported container path was used.
Preview source build/deployment succeeded. Browser verified A creation, R rename,
I selection, G memberships, named-group X removal while both existing follows
remained, protected All following, and group deletion. A one-creator group loaded
48 tiles whose creator IDs all matched RedLetterMedia. Reload/restore retained
the scoped group. Live app-data volume confirmed the group's metadata persisted.
Both temporary test groups were removed; returned to All following with the two
original follows intact. New empty manager/feed guidance verified. Installed
source/configuration hashes unchanged; no installed container/volume changes,
commit, or push. Smaller-device coverage remains pending.

Screenshots: individuous-following-groups.png and
individuous-following-group-empty.png in release-prep/probes.
