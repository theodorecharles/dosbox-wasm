# DOSBox WASM runbook

## Source boundary

The vendored engine is the official DOSBox 0.74-3 GPL source release. Browser
changes are limited to an Emscripten host target, inert physical-CD support,
nonblocking SDL compatibility seams, surface rendering, and default WASD input.
Do not submit any change from this repository upstream.

No Jill game file may enter Git, `web/dist`, or a Docker image. The committed
manifest contains validation metadata only. Regenerate it only from a
configured local copy with `JILL_DATA_ROOT=/path/to/DOS npm run manifest:data`,
then inspect every path and hash before committing it.

## Build loop

Use an isolated exact framework checkout because the public framework branch
may contain documentation commits after the immutable runtime release:

```bash
EMSDK_DIR=/home/ted/emsdk \
WASM_FRAMEWORK_DIR=/tmp/wasm-game-framework-v0.7.5 \
./scripts/test-web.sh
```

The target uses the portable normal CPU core, SDL surface renderer and audio,
Asyncify-backed browser yielding, growing memory, and a modularized JavaScript
factory. Physical CD-ROM, dynamic CPU recompilation, OpenGL output, SDL_net,
and MIDI backends are deliberately disabled for the first milestone.

## Browser milestone

After the serialized Chromium slot is available, build the suite image, mount
an empty persistent `/data`, provision one episode through the launcher, and
verify:

1. the canonical launcher and selected PWA metadata render;
2. loading restores data from the container once and IndexedDB afterward;
3. the DOSBox log reaches the mounted C: drive and starts the selected JILL EXE;
4. title/menu and a playable level render without stretching;
5. W/A/S/D and arrows move, game action keys work, and audio starts after Play;
6. fullscreen follows the remembered launcher preference;
7. Network contains no direct `/data` request and hard refresh uses the cache.

Until that runtime smoke succeeds, every episode remains **Still in development**.
