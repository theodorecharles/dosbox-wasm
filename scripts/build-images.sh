#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
framework_dir="${WASM_FRAMEWORK_DIR:-$repo_dir/../wasm-game-framework}"
required_version="0.7.1"
required_commit="9359fb1"

[[ "$(node -p "require('${framework_dir}/package.json').version")" == "$required_version" ]]
[[ "$(git -C "$framework_dir" rev-parse --short=7 HEAD)" == "$required_commit" ]]

EMSDK_DIR="${EMSDK_DIR:-/home/ted/emsdk}" WASM_FRAMEWORK_DIR="$framework_dir" \
  "$repo_dir/scripts/build-web.sh"
"$framework_dir/scripts/build-base-image.sh" "wasm-game-framework:$required_version"

images=(
  'dosbox-wasm:dev suite'
  'jill1-wasm:dev jill1'
  'jill2-wasm:dev jill2'
  'jill3-wasm:dev jill3'
)
for specification in "${images[@]}"; do
  image="${specification%% *}"
  variant="${specification#* }"
  WASM_GAME_FRAMEWORK_IMAGE="wasm-game-framework:$required_version" \
    "$framework_dir/scripts/build-static-image.sh" "$repo_dir/web/dist" "$image" "$variant"
  [[ "$(docker run --rm --entrypoint node "$image" -p "require('/opt/wasm-game-framework/package.json').version")" == "$required_version" ]]
  docker run --rm --entrypoint sh "$image" -c \
    'test ! -e /opt/game-site/index.html && test ! -e /data/JILL.EXE && test -f /opt/game-site/dosbox.wasm'
  printf 'Verified %s (%s).\n' "$image" "$variant"
done
