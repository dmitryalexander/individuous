#!/bin/sh
set -eu
assets="$1"
# Include player scripts, the bootstrap, artwork and styles, not only the bundle.
build=$(cd "$assets" && find . -type f | LC_ALL=C sort | while IFS= read -r file; do sha256sum "$file"; done | sha256sum | cut -d ' ' -f 1)
printf '\n:root{--individuous-asset-build:"%s"}\n' "$build" >> "$assets/css/default.css"
printf '\n;window.individuousAssetBuild="%s";\n' "$build" >> "$assets/js/handlers.js"
sed -i "s/__INDIVIDUOUS_ASSET_BUILD__/$build/g" "$assets/js/pinless-refresh.js"
for page in star.html search-term-manager.html; do
    sed -i "s/?v=release/?v=$build/g" "$assets/$page"
done
