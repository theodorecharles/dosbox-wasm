# DOSBox WASM

Native DOSBox in WebAssembly, packaged with `wasm-game-framework` as a reusable
browser home for DOS games. The first family is the complete Jill of the Jungle
trilogy. This port is built from the official DOSBox 0.74-3 source release; it
does not use an existing third-party DOSBox WebAssembly port.

| Game | Status | Image |
| --- | --- | --- |
| Jill of the Jungle | **Still in development** | `jill1-wasm` |
| Jill Goes Underground | **Still in development** | `jill2-wasm` |
| Jill Saves the Prince | **Still in development** | `jill3-wasm` |

## What the framework provides

The repository contains no custom HTML, CSS, service worker, or web manifest.
`wasm-game-framework` supplies the launcher, suite selector, installable PWA,
fullscreen preference, responsive 4:3 canvas, provisioning flow, and private
IndexedDB cache. The game adapter only selects the episode, validates and
mounts its files, and starts the native engine.

WASD is mapped to the original arrow-key movement in the Emscripten platform
seam. Arrow keys continue to work. Rendering uses the original pixel-oriented
DOS presentation in a contained 4:3 viewport; the browser never stretches it.

## Game data

No Jill executable or content file is committed or included in an image. On a
fresh deployment, open the site and provision the episode folder
once. The container validates all files by exact name, byte length, and SHA-256
and stores them beneath its persistent `/data` volume:

- `/data/jill1` for episode 1;
- `/data/jill2` for episode 2;
- `/data/jill3` for episode 3.

Once the selected episode is ready, the upload controls disappear. The browser
also retains a validated private IndexedDB copy so later launches avoid another
download from the container. `/data` itself is never exposed as an HTTP route.

## Build

Prerequisites are Emscripten, Autoconf/Automake, Node.js, WABT, ImageMagick,
Docker, and an exact checkout of `wasm-game-framework` v0.7.5 at `11b9af4`.

```bash
EMSDK_DIR=/path/to/emsdk \
WASM_FRAMEWORK_DIR=/path/to/wasm-game-framework-v0.7.5 \
./scripts/test-web.sh

EMSDK_DIR=/path/to/emsdk \
WASM_FRAMEWORK_DIR=/path/to/wasm-game-framework-v0.7.5 \
./scripts/build-images.sh
```

The second command produces a suite image and three independently branded
images: `dosbox-wasm:dev`, `jill1-wasm:dev`, `jill2-wasm:dev`, and
`jill3-wasm:dev`.

Never submit this browser port or its framework adaptations to the DOSBox
upstream project.
