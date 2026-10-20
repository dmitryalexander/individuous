#!/bin/sh
set -eu
assets="$1"
build=$(cat "$assets/css/default.css" "$assets/js/handlers.js" | sha256sum | cut -d ' ' -f 1)
printf '\n:root{--individuous-asset-build:"%s"}\n' "$build" >> "$assets/css/default.css"
printf '\n;window.individuousAssetBuild="%s";\n' "$build" >> "$assets/js/handlers.js"
sed -i "s/__INDIVIDUOUS_ASSET_BUILD__/$build/g" "$assets/js/pinless-refresh.js"
for page in star.html search-term-manager.html; do
    sed -i "s/?v=release/?v=$build/g" "$assets/$page"
done
