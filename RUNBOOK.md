# DOSBox WASM runbook

## Source and data boundary

The vendored engine is the official DOSBox 0.74-3 GPL source release. Browser
changes are limited to an Emscripten host target, inert physical-CD support,
nonblocking SDL compatibility seams, surface rendering, and default WASD input.
Do not submit changes from this repository upstream.

No owner-supplied game file may enter Git, `web/dist`, or a Docker image. The
committed manifest contains validation metadata only. Prepare source data in a
temporary or owner-controlled directory, regenerate the manifest, inspect the
paths and hashes, run the complete test suite, and discard temporary copies.

The locally installed folders `JILL`, `JILL2`, `JILL3`, `JAZZ`, `DUKE1`,
`DUKE2`, and `GTA` can be read directly beneath one `DOS_DATA_ROOT`. The NFS
and SimCity policies deliberately omit installers, documentation, hardware
probes, mutable saves, scores, and local configuration files where applicable.

### Prepare The Need for Speed

Use only this DOS archive:

- `Need For Speed (1995)(Pioneer Productions).zip`
- SHA-256: `f3a204c48dd39a5735690a45729683a10c00336abfb80b620d74c9213d25ed5a`

Verify the archive with `sha256sum`, extract it with `unzip` into an empty
staging directory, and point `NFS_DATA_ROOT` at the directory containing
`TNFS.EXE`, `paths.dat`, and `GAMEDATA`. The runtime launches `TNFS.EXE SB` and
creates its own mutable configuration after provisioning.

### Prepare SimCity 2000

Use only the revised DOS archive:

- `Sim City 2000 (1993)(Maxis Software Inc)(Rev).zip`
- SHA-256: `c759d7255fbb3c234ed88f01d6ffbd17661f953b6601f8db1607ccd84320d5b4`

Verify and extract the archive into an empty staging directory. In native
DOSBox, mount that directory as floppy drive A and a separate empty staging
directory as C, then run `A:\INSTALL.EXE`. Install to `C:\SC2000` using:

- `SimMayor` for the requested name and `SimBusiness` for company;
- VESA Super VGA graphics;
- Sound Blaster 16 for music and effects;
- the same merged archive directory when the installer asks for disk 2.

Point `SC2000_DATA_ROOT` at the resulting `SC2000` directory. Before manifest
generation, confirm its `SC2000.CFG` SHA-256 is
`a4a2e3a1423e4a3f6b255f8d6bb40ec145549f6aaab93f7bfb659d9bfded671b`.
The curated runtime retains the executable, configuration, sound drivers,
cities, and scenarios while excluding installer and probe utilities.

Regenerate all policies together so a missing source cannot silently drop a
variant:

```bash
DOS_DATA_ROOT=/path/to/DOS \
NFS_DATA_ROOT=/path/to/prepared/NFS \
SC2000_DATA_ROOT=/path/to/prepared/SC2000 \
npm run manifest:data

npm test
```

## Build loop

Use the immutable framework release:

```bash
EMSDK_DIR=/home/ted/emsdk \
WASM_FRAMEWORK_DIR=/home/ted/Development/wasm/wasm-game-framework \
./scripts/test-web.sh

EMSDK_DIR=/home/ted/emsdk \
WASM_FRAMEWORK_DIR=/home/ted/Development/wasm/wasm-game-framework \
./scripts/build-images.sh
```

Both scripts require framework v0.7.6 at commit
`e617f090deaa294dacd033afa52c09f811a3e690`. The target uses the
portable normal CPU core, SDL surface renderer and audio, Asyncify-backed
browser yielding, growing memory, and a modularized JavaScript factory.
Physical CD-ROM, dynamic CPU recompilation, OpenGL output, SDL_net, and MIDI
backends remain disabled.

## Container lifecycle

Create one persistent volume, then start either the suite image or a locked
single-title image:

```bash
docker volume create dosbox-wasm-data
docker run -d --name dosbox-wasm \
  -p 8080:8088 \
  -v dosbox-wasm-data:/data \
  dosbox-wasm:dev
```

Open `http://HOST:8080`. Use the launcher's provisioning control to populate
each selected title's `/data/<variant>` policy. Routine operations are:

```bash
docker logs -f dosbox-wasm
docker stop dosbox-wasm
docker start dosbox-wasm
docker restart dosbox-wasm
docker rm dosbox-wasm
```

Removing the container does not remove the named data volume. To update, stop
and remove the old container, rebuild or pull the replacement image, and run
the same start command with the existing volume.

To require a shared play password, pass `WASM_GAME_PASSWORD` at runtime. Prefer
Docker Compose secrets or an environment file with restricted permissions over
putting the password directly in shell history:

```bash
docker run -d --name dosbox-wasm \
  --env-file /path/to/dosbox-wasm.env \
  -p 8080:8088 \
  -v dosbox-wasm-data:/data \
  dosbox-wasm:dev
```

The environment file may contain `WASM_GAME_PASSWORD=...` and optionally
`WASM_GAME_PASSWORD_TTL=12h`. With no password (unset or empty), behavior is
unchanged. With one set, the launcher and protected game routes require it;
the password is not written into manifests, browser scripts, URLs, or logs.

## Runtime milestone

All titles remain **Still in development** until a browser runtime pass verifies:

1. suite selection and locked-image PWA identity for every variant;
2. first-time provisioning and later IndexedDB restoration;
3. nested directory reconstruction for GTA, NFS, and SimCity 2000;
4. each configured DOS command reaches its title/menu and playable state;
5. WASD/arrows, game action keys, audio-after-Play, and fullscreen preference;
6. password-disabled and password-enabled launcher behavior;
7. no direct `/data` or `/local-data` route under fresh or cached launches.

Native DOSBox smoke tests reached the executable for all prepared titles; NFS
reached its car intro and SimCity 2000 reached its intro with the curated data.
That evidence does not replace the browser milestone.
