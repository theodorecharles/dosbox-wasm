#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
framework_dir="${WASM_FRAMEWORK_DIR:-$repo_dir/../wasm-game-framework}"

EMSDK_DIR="${EMSDK_DIR:-/home/ted/emsdk}" \
WASM_FRAMEWORK_DIR="$framework_dir" \
"$repo_dir/scripts/build-web.sh"

node --check "$repo_dir/web/dist/dosbox.js"
node --check "$repo_dir/web/dist/game-adapter.js"
wasm-validate "$repo_dir/web/dist/dosbox.wasm"
jq -e '.variants | keys == ["jill1", "jill2", "jill3"]' "$repo_dir/web/dist/wasm-game.json" >/dev/null
jq -e '[.variants[].files | length] == [28, 27, 34]' "$repo_dir/web/dist/wasm-game-data.json" >/dev/null

for forbidden in index.html service-worker.js manifest.webmanifest wasm-game-framework.js wasm-game-framework.css; do
  test ! -e "$repo_dir/web/$forbidden"
done
cmp "$framework_dir/dist/wasm-game-framework.js" "$repo_dir/web/dist/shared-shell/wasm-game-framework.js"
cmp "$framework_dir/dist/wasm-game-bootstrap.js" "$repo_dir/web/dist/shared-shell/wasm-game-bootstrap.js"

if git -C "$repo_dir" ls-files | grep -Ei '\.(jn[123]|sha|vcl|ddt|dma|dem|mac|epc)$|(^|/)JILL[123]?\.EXE$'; then
  printf 'A proprietary Jill game file is tracked.\n' >&2
  exit 1
fi
if find "$repo_dir/web/dist" -type f | grep -Ei '\.(jn[123]|sha|vcl|ddt|dma|dem|mac|epc)$|/JILL[123]?\.EXE$'; then
  printf 'A proprietary Jill game file entered the web build.\n' >&2
  exit 1
fi
rg -q 'case SDLK_w: event.key.keysym.sym = SDLK_UP' "$repo_dir/vendor/dosbox/src/gui/sdlmain.cpp"
rg -q 'sASYNCIFY=1' "$repo_dir/scripts/build-web.sh"
rg -q 'createDosBoxModule' "$repo_dir/web/dist/dosbox.js"

WASM_FRAMEWORK_DIR="$framework_dir" "$repo_dir/scripts/test-static.sh"
git -C "$repo_dir" diff --check
printf 'DOSBox native build, framework contract, WASD seam, and retail-data boundary checks passed.\n'

