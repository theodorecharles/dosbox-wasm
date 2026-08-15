# DOSBox WASM

Native DOSBox 0.74-3 in WebAssembly, packaged with `wasm-game-framework` as a
reusable browser home for classic DOS games. It is built from the official
DOSBox source release and does not use a third-party DOSBox WebAssembly port.

| Game | Status | Image |
| --- | --- | --- |
| Jill of the Jungle | **Still in development** | `jill1-wasm` |
| Jill Goes Underground | **Still in development** | `jill2-wasm` |
| Jill Saves the Prince | **Still in development** | `jill3-wasm` |
| Jazz Jackrabbit | **Still in development** | `jazz-wasm` |
| Duke Nukem | **Still in development** | `duke1-wasm` |
| Duke Nukem II | **Still in development** | `duke2-wasm` |
| Grand Theft Auto (DOS demo) | **Still in development** | `gta1-wasm` |
| The Need for Speed | **Still in development** | `nfs1-wasm` |
| SimCity 2000 | **Still in development** | `simcity2000-wasm` |

GTA 2, SimCity 3000, and Windows Need for Speed releases are intentionally out
of scope: they are not DOS titles. The available GTA folder is identified
honestly as the original eight-bit-color DOS demo.

## Framework and controls

The repository contains no custom HTML, CSS, service worker, or web manifest.
`wasm-game-framework` supplies the launcher, suite selector, installable PWA,
optional password gate, fullscreen preference, responsive 4:3 canvas,
provisioning flow, controller selection, and private IndexedDB services. The
adapter selects the title, restores its writable state, validates and mounts
its program, and starts DOSBox with that title's commands.

WASD maps to the original arrow-key movement in the Emscripten platform seam;
arrow keys continue to work. Native controller events use the same DOSBox
keyboard/mouse path: the left stick moves, face/shoulder buttons map to each
game's original action keys, and SimCity 2000 uses the right stick plus
triggers as its mouse. Disconnecting a controller releases every held input.
Rendering keeps the original pixel-oriented DOS presentation in a contained
4:3 viewport.

Each variant has its own IDBFS mount at `/persistent/dosbox/<variant>`. DOSBox
uses that mount as `HOME`, so its generated configuration is restored from
`/persistent/dosbox/<variant>/.dosbox`; the private DOS drive (including games
that require write-open access to original resources) and mutable game state is
restored beneath `/persistent/dosbox/<variant>/game`. The framework attaches
and restores the mount before DOSBox main, then handles dirty, periodic,
page-lifecycle, and durability flushes.

## Game data

No game executable or content file is committed or included in an image. On a
fresh deployment, choose a title and provision its prepared folder once. Every
file is checked by exact name, byte length, and SHA-256 before it is stored in
the persistent `/data/<variant>` directory. The browser retains a validated,
private IndexedDB copy for later launches. Neither `/data` nor `/local-data` is
an HTTP route.

The expected prepared folder names are `JILL`, `JILL2`, `JILL3`, `JAZZ`,
`DUKE1`, `DUKE2`, `GTA`, `NFS`, and `SC2000`. NFS and SimCity 2000 require the
specific archive preparation documented in [RUNBOOK.md](RUNBOOK.md). Nested
game paths are retained for GTA, NFS, and SimCity 2000.

The installed sources did not include a standalone game icon that could safely
be redistributed outside the owner-data boundary. All variants therefore use
the generic DOSBox icon; assets such as GTA's `GTA.PCX` remain private game
data.

## Build

Prerequisites are Emscripten, Autoconf/Automake, Node.js, WABT, ImageMagick,
Docker, and an exact checkout of `wasm-game-framework` v0.9.2 at
`53bc7e6eeef1ae35dcf3b25dea4e3ec0ab46726f`.

```bash
EMSDK_DIR=/path/to/emsdk \
WASM_FRAMEWORK_DIR=/path/to/wasm-game-framework-v0.9.2 \
./scripts/test-web.sh

EMSDK_DIR=/path/to/emsdk \
WASM_FRAMEWORK_DIR=/path/to/wasm-game-framework-v0.9.2 \
./scripts/build-images.sh
```

The image build produces the suite `dosbox-wasm:dev` plus the nine locked
images listed above, all based on `wasm-game-framework:0.9.2`. See the runbook
for container start, stop, update, data-volume, and optional-password commands.

Never submit this browser port or its framework adaptations to the DOSBox
upstream project.
