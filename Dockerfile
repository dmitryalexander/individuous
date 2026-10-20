# https://github.com/openssl/openssl/releases/tag/openssl-3.6.3
ARG OPENSSL_VERSION='3.6.3'
ARG OPENSSL_SHA256='243a86649cf6f23eeb6a2ff2456e09e5d77dd9018a54d3d96b0c6bdd6ba6c7f1'

FROM 84codes/crystal:1.20.3-alpine AS dependabot-crystal

# We compile openssl ourselves due to a memory leak in how crystal interacts
# with openssl
# Reference: https://github.com/iv-org/invidious/issues/1438#issuecomment-3087636228
FROM dependabot-crystal AS openssl-builder
RUN apk add --no-cache curl perl linux-headers

WORKDIR /

ARG OPENSSL_VERSION
ARG OPENSSL_SHA256
RUN curl -Ls "https://github.com/openssl/openssl/releases/download/openssl-${OPENSSL_VERSION}/openssl-${OPENSSL_VERSION}.tar.gz" --output openssl-${OPENSSL_VERSION}.tar.gz
RUN echo "${OPENSSL_SHA256}  openssl-${OPENSSL_VERSION}.tar.gz" | sha256sum -c
RUN tar -xzvf openssl-${OPENSSL_VERSION}.tar.gz

RUN cd openssl-${OPENSSL_VERSION} && ./Configure --openssldir=/etc/ssl && make -j$(nproc)

FROM dependabot-crystal AS builder

RUN apk add --no-cache sqlite-static yaml-static
RUN apk del openssl-dev openssl-libs-static

ARG release

WORKDIR /invidious
COPY ./shard.yml ./shard.yml
COPY ./shard.lock ./shard.lock
RUN shards install

COPY ./src/ ./src/
ARG INDIVIDUOUS_BUILD_BRANCH=individuous
ARG INDIVIDUOUS_BUILD_COMMIT=48c6110+individuous
ARG INDIVIDUOUS_BUILD_DATE=2026.10.20
COPY ./config/ ./config/
COPY ./locales/ ./locales/
COPY ./spec/ ./spec/
COPY ./mocks/ ./mocks/

# Required for fetching player dependencies
COPY ./scripts/ ./scripts/
COPY ./assets/ ./assets/
COPY ./videojs-dependencies.yml ./videojs-dependencies.yml

ARG OPENSSL_VERSION
COPY --from=openssl-builder /openssl-${OPENSSL_VERSION} /openssl-${OPENSSL_VERSION}
RUN LD_LIBRARY_PATH=/openssl-${OPENSSL_VERSION} PKG_CONFIG_PATH=/openssl-${OPENSSL_VERSION} crystal spec --warnings all \
    --link-flags "-lxml2 -llzma -no-pie"

# 2026-08-04:
#
# `-no-pie` has been added to link flags due to missing debug information
# when compiling Invidious using `--static` (because `--static` enables PIE, but
# with PIE enabled, Crystal cannot provide debug information when an error
# in Invidious appears)
# References:
# - https://forum.crystal-lang.org/t/gcc-15-on-alpine-linux-changes-static-to-imply-pie-i-e-static-pie/9074/5?u=fijxu
# - https://github.com/crystal-lang/distribution-scripts/issues/445
# - https://github.com/84codes/crystal-packages/issues/41
#
# `-no-pie` can be removed once it's fixed.
RUN --mount=type=cache,target=/root/.cache/crystal if [[ "${release}" == 1 ]] ; then \
        PKG_CONFIG_PATH=/openssl-${OPENSSL_VERSION} \
        crystal build ./src/invidious.cr \
        --release \
        --static --warnings all \
        --link-flags "-lxml2 -llzma -no-pie"; \
    else \
        PKG_CONFIG_PATH=/openssl-${OPENSSL_VERSION} \
        crystal build ./src/invidious.cr \
        --static --warnings all \
        --link-flags "-lxml2 -llzma -no-pie"; \
    fi

FROM alpine:3.24 AS upstream-runtime
RUN apk add --no-cache rsvg-convert ttf-opensans tini tzdata
WORKDIR /invidious
RUN addgroup -g 1000 -S invidious && \
    adduser -u 1000 -S invidious -G invidious
COPY --chown=invidious ./config/config.* ./config/
RUN mv -n config/config.example.yml config/config.yml
RUN sed -i 's/host: \(127.0.0.1\|localhost\)/host: invidious-db/' config/config.yml
COPY ./config/sql/ ./config/sql/
COPY ./locales/ ./locales/
COPY --from=builder /invidious/assets ./assets/
COPY --from=builder /invidious/invidious .
RUN chmod o+rX -R ./assets ./config ./locales

EXPOSE 3000
USER invidious
ENTRYPOINT ["/sbin/tini", "--"]
CMD [ "/invidious/invidious" ]

# Individuous interface; preserve hydration and initialization order.
FROM upstream-runtime AS individuous
USER root
COPY ui/theme.css /tmp/pinless-theme.css
RUN cat /tmp/pinless-theme.css >> /invidious/assets/css/default.css
# First of our scripts in handlers.js: loads playlists and search groups saved on the server (appdata service)
# into browser storage before anything reads them, and mirrors later changes back.
COPY ui/app-data.js /tmp/app-data.js
RUN cat /tmp/app-data.js >> /invidious/assets/js/handlers.js
# Search tags (#shorts, #4k, #week...): read the search box before search-improvements.js (2026-10-14).
COPY ui/search-tags.js /tmp/search-tags.js
COPY ui/search-tags.css /tmp/search-tags.css
RUN cat /tmp/search-tags.js >> /invidious/assets/js/handlers.js && cat /tmp/search-tags.css >> /invidious/assets/css/default.css
COPY ui/search-improvements.js /tmp/search-improvements.js
RUN cat /tmp/search-improvements.js >> /invidious/assets/js/handlers.js
COPY ui/wall-scroll.js /tmp/wall-scroll.js
COPY ui/wall.css /tmp/wall.css
RUN cat /tmp/wall-scroll.js >> /invidious/assets/js/handlers.js && cat /tmp/wall.css >> /invidious/assets/css/default.css
# Shared header, menu and collapsible styles. The old YouTube "quiet" rules and quiet.js were replaced by pinless-look.
COPY ui/quiet.css /tmp/quiet.css
RUN cat /tmp/quiet.css >> /invidious/assets/css/default.css
# Pinless look: header, hover-zone tiles, watch page and automatic refresh. See README.txt.
COPY ui/pinless-look.css /tmp/pinless-look.css
COPY ui/sandbox-state.js /tmp/sandbox-state.js
RUN cat /tmp/sandbox-state.js >> /invidious/assets/js/handlers.js
COPY ui/pinless-look.js /tmp/pinless-look.js
COPY ui/aggregate-groups.js /tmp/aggregate-groups.js
RUN cat /tmp/aggregate-groups.js >> /invidious/assets/js/handlers.js
RUN cat /tmp/pinless-look.css >> /invidious/assets/css/default.css && cat /tmp/pinless-look.js >> /invidious/assets/js/handlers.js
COPY ui/interest-bar.css /tmp/interest-bar.css
COPY ui/interest-bar.js /tmp/interest-bar.js
RUN cat /tmp/interest-bar.css >> /invidious/assets/css/default.css && cat /tmp/interest-bar.js >> /invidious/assets/js/handlers.js
COPY ui/subscription-import.js /tmp/subscription-import.js
COPY ui/following-groups-model.js /tmp/following-groups-model.js
COPY ui/following-groups.js /tmp/following-groups.js
COPY ui/following-groups.css /tmp/following-groups.css
RUN cat /tmp/following-groups-model.js /tmp/following-groups.js >> /invidious/assets/js/handlers.js && cat /tmp/following-groups.css >> /invidious/assets/css/default.css
RUN cat /tmp/subscription-import.js >> /invidious/assets/js/handlers.js
# Theme changes must preserve the wall/header classes added by the local app.
RUN sed -i "s/document.body.className = 'dark-theme';/document.body.classList.remove('light-theme','no-theme'); document.body.classList.add('dark-theme');/;s/document.body.className = 'light-theme';/document.body.classList.remove('dark-theme','no-theme'); document.body.classList.add('light-theme');/;s/document.body.className = 'no-theme';/document.body.classList.remove('dark-theme','light-theme'); document.body.classList.add('no-theme');/" /invidious/assets/js/themes.js
# Some watch pages omit the alternate-comments link.
RUN sed -i 's/document.getElementById("try-reddit-comments-link").onclick = swap_comments;/if (document.getElementById("try-reddit-comments-link")) document.getElementById("try-reddit-comments-link").onclick = swap_comments;/' /invidious/assets/js/watch.js
# Served as /js/pinless-refresh.js and loaded through the banner setting in compose.yaml.
COPY ui/pinless-refresh.js /invidious/assets/js/pinless-refresh.js
COPY ui/warning.png /invidious/assets/warning.png
# Notifications are disabled for this local app, including cached-client reconnects.
COPY ui/notifications-disabled.js /invidious/assets/js/notifications.js
COPY ui/random-feed.js /tmp/random-feed.js
RUN cat /tmp/random-feed.js >> /invidious/assets/js/handlers.js


COPY ui/star.html /invidious/assets/star.html

COPY ui/sandbox-feed.js /tmp/sandbox-feed.js
RUN cat /tmp/sandbox-feed.js >> /invidious/assets/js/handlers.js

# Menu page redesign (2026-10-14): replaces account-settings.js (the long preferences form is gone).
# site-prefs.js saves the few switches left (privacy mode, autoplay, loop); player-controls.js puts Autoplay and
# Loop on the video; menu-page.js/css build the Menu page.
COPY ui/site-prefs.js /tmp/site-prefs.js
COPY ui/menu-page.js /tmp/menu-page.js
COPY ui/menu-page.css /tmp/menu-page.css
COPY ui/player-controls.js /tmp/player-controls.js
COPY ui/player-controls.css /tmp/player-controls.css
RUN cat /tmp/site-prefs.js /tmp/menu-page.js /tmp/player-controls.js >> /invidious/assets/js/handlers.js && cat /tmp/menu-page.css /tmp/player-controls.css >> /invidious/assets/css/default.css

# Hotkeys guide on the Menu page (2026-10-15): explains A / R / X / S / I and the mouse zones.
COPY ui/hotkeys-guide.js /tmp/hotkeys-guide.js
COPY ui/hotkeys-guide.css /tmp/hotkeys-guide.css
RUN cat /tmp/hotkeys-guide.js >> /invidious/assets/js/handlers.js && cat /tmp/hotkeys-guide.css >> /invidious/assets/css/default.css

# Hidden videos page (2026-10-15): /search?pt_page=hidden replaces the old Hidden videos pop-up (needs pinless-look first).
COPY ui/hidden-page.js /tmp/hidden-page.js
COPY ui/hidden-page.css /tmp/hidden-page.css
RUN cat /tmp/hidden-page.js >> /invidious/assets/js/handlers.js && cat /tmp/hidden-page.css >> /invidious/assets/css/default.css

COPY ui/branding.js /tmp/branding.js
RUN cat /tmp/branding.js >> /invidious/assets/js/handlers.js

COPY ui/youtube-connection.js /tmp/youtube-connection.js
COPY ui/youtube-connection.css /tmp/youtube-connection.css
COPY ui/youtube-session-help.png /invidious/assets/youtube-session-help.png
RUN cat /tmp/youtube-connection.js >> /invidious/assets/js/handlers.js && cat /tmp/youtube-connection.css >> /invidious/assets/css/default.css

COPY ui/watch-playlist.js /tmp/watch-playlist.js
COPY ui/watch-playlist.css /tmp/watch-playlist.css
RUN cat /tmp/watch-playlist.js >> /invidious/assets/js/handlers.js && cat /tmp/watch-playlist.css >> /invidious/assets/css/default.css

USER invidious


USER root
COPY ui/external-tools.js /tmp/external-tools.js
COPY ui/external-tools.css /tmp/external-tools.css
RUN cat /tmp/external-tools.js >> /invidious/assets/js/handlers.js && cat /tmp/external-tools.css >> /invidious/assets/css/default.css
USER invidious

USER root
COPY ui/empty-tutorial.js /tmp/empty-tutorial.js
COPY ui/empty-tutorial.css /tmp/empty-tutorial.css
COPY ui/tutorial-welcome.png /invidious/assets/tutorial-welcome.png
COPY ui/tutorial-ideas.png /invidious/assets/tutorial-ideas.png
COPY ui/tutorial-thinking.png /invidious/assets/tutorial-thinking.png
RUN cat /tmp/empty-tutorial.js >> /invidious/assets/js/handlers.js && cat /tmp/empty-tutorial.css >> /invidious/assets/css/default.css
USER invidious

USER root
COPY ui/menu-keycaps.js /tmp/menu-keycaps.js
RUN cat /tmp/menu-keycaps.js >> /invidious/assets/js/handlers.js
COPY ui/tutorial-history.png ui/tutorial-hidden.png ui/tutorial-following.png ui/tutorial-terms.png ui/tutorial-search.png ui/tutorial-youtube.png /invidious/assets/
USER invidious

USER root
COPY ui/search-term-manager.html /invidious/assets/search-term-manager.html
COPY ui/tutorial-restore.png /invidious/assets/tutorial-restore.png
COPY ui/tutorial-restore-v2.png ui/tutorial-following-v2.png /invidious/assets/
COPY ui/tutorial-restore-v3.png ui/tutorial-following-v3.png /invidious/assets/
COPY ui/tutorial-restore-v4.png ui/tutorial-following-v4.png /invidious/assets/
COPY ui/tutorial-following-trophy.png /invidious/assets/tutorial-following-trophy.png
COPY ui/tutorial-restore-meme.png /invidious/assets/tutorial-restore-meme.png
COPY ui/tutorial-following-trophy-down.png /invidious/assets/tutorial-following-trophy-down.png
USER invidious

USER root
COPY ui/data-controls.js /tmp/data-controls.js
COPY ui/data-controls.css /tmp/data-controls.css
RUN cat /tmp/data-controls.js >> /invidious/assets/js/handlers.js && cat /tmp/data-controls.css >> /invidious/assets/css/default.css
USER invidious

# Pair every interface change with fresh URLs on the standalone pages, and let
# the banner bootstrap detect mixed cached assets on upstream-rendered pages.
USER root
COPY docker/stamp-assets.sh /tmp/stamp-assets.sh
RUN sh /tmp/stamp-assets.sh /invidious/assets
USER invidious
