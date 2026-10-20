# Individuous — consolidated release, 2026-10-20

This source combines the installed functionality and the latest development UI.
Start.cmd (Windows) or Docker Compose builds this repository independently.
Keep your private .env and data volumes when upgrading. Never publish either.

## Fixed in this release

- Standalone playlist/search-term pages use content-stamped CSS/JS URLs and the
  shared update bootstrap. Mixed cached styles/scripts refresh together, without
  interrupting active playback or changing saved data.

- Save/load reusable login hashes, separate from ordinary info exports.
- Menu info export/import and confirmed Clear everything.
- Per-item compare-and-save revisions prevent silent collection overwrites.
  Conflicts preserve unsaved browser data until an explicit choice; download
  that copy before discarding either version. Unrelated collection edits still save.
- Damaged stores fail closed and offer explicitly selected recovery copies.
- First-sync copies are bounded to 20 files, 128 MiB and 30 days, retaining the
  newest; daily recovery retains 14 dates.
- Durable operation journals finish interrupted import/reset operations before
  new data is accepted. Never manually delete an unfinished operation.json.
- Compose instances have independent names, image tags and volumes.

- Native account mutations pass through the same serialized gate as reset,
  with per-page epochs. Old unversioned requests must reload. Normal page
  navigation remains available. The internal services are not published separately.
- Companion, gateway and PostgreSQL images are pinned to the reviewed digests.
- Existing automatic-login account mappings survive bootstrap.
- Builds include and execute upstream tests, and work without .git metadata.
- The newer All Groups/All Creators views, guidance artwork, menu shortcuts,
  following groups and external download/transcript tools are now the release UI.

## Existing volume overrides

In your private .env, retain the existing DB_PASSWORD, HMAC_KEY, COMPANION_KEY
and AUTO_SESSION_ID. Optional INDIVIDUOUS_DB_VOLUME, INDIVIDUOUS_DATA_VOLUME,
INDIVIDUOUS_SESSION_VOLUME and INDIVIDUOUS_CACHE_VOLUME select existing volumes.
INDIVIDUOUS_SOURCE can point a local deployment wrapper at this source tree.
Use COMPOSE_PROJECT_NAME and INDIVIDUOUS_PORT for a separate development instance.
Do not start two databases against the same volume.

For a Git clone run `git submodule update --init mocks`; the fixture commit is
b55d58dea94f7144ff0205857dfa70ec14eaa872. Source archives include these fixtures.

## Verification scope

See [RELEASE_VERIFICATION.md](RELEASE_VERIFICATION.md) for exact test results.
Tests use synthetic credentials and disposable stores. Browser destructive actions
are mocked on installed apps. No real reset/import is part of the upgrade.
External Pinterest/YouTube availability and expired credentials remain outside
this application's control. This was a targeted review of custom code and build
configuration, not an audit of every upstream dependency.

## Watch/creator shortcut follow-up

S over the body of a watch page now shuffles related videos while keeping the
main player attached and in place. S over a creator page shuffles its loaded video
cards. Header controls, typing fields and open dialogs retain their guards. A
shuffle always changes the visible order when at least two cards are present.
Three owner-supplied screenshots now show the feed, creator and watch views.

Cache audit follow-up: Back/Forward restored pages recheck saved-data revisions and
reset epochs while preserving pending edits.
The build fingerprint includes all shipped assets. Refresh covers page-specific
player scripts/styles and local artwork, supports unavailable session storage, and
detects a newly deployed build after Back/Forward. Gateway revalidation does not
trust file timestamps for CSS/JS; personalized HTML/JSON is no-store.

Menu tutorials: compact uppercase action headings sit beside amber input caps.
Mouse actions use matching CLICK badges; explanatory text remains below.
