(function () {
  'use strict';

  const runtime = { module: null, manifest: null, started: false, state: 'launcher' };

  async function sha256Hex(file) {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function loadManifest(context) {
    const response = await fetch('/wasm-game-data.json', { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error(`DOS data policy failed with HTTP ${response.status}.`);
    const root = await response.json();
    const selected = root.variants?.[context.variant];
    if (!selected || !Array.isArray(selected.files) || !selected.executable) {
      throw new Error(`DOS data policy has no ${context.variant} definition.`);
    }
    runtime.manifest = selected;
    return selected;
  }

  function ownerData(context) {
    const manifest = runtime.manifest;
    return context.framework.createOwnerDataSet({
      namespace: manifest.namespace,
      version: manifest.version,
      files: manifest.files.map(spec => ({
        key: spec.key,
        name: spec.name,
        names: spec.names,
        size: spec.size,
        mountName: spec.name,
        async validate(file) {
          context.setLoading(`Verifying ${spec.name}…`);
          if (await sha256Hex(file) !== spec.sha256) throw new Error(`${spec.name} failed SHA-256 verification.`);
        }
      }))
    });
  }

  function loadScript(source) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = source;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${source}.`));
      document.head.appendChild(script);
    });
  }

  async function loadEngine(context) {
    if (runtime.module) return runtime.module;
    await loadScript('/dosbox.js');
    if (typeof globalThis.createDosBoxModule !== 'function') throw new Error('DOSBox module factory was not exported.');
    runtime.module = await globalThis.createDosBoxModule({
      canvas: context.elements.canvas,
      noInitialRun: true,
      locateFile: path => `/${path}`,
      print: (...args) => context.log(`[DOSBox] ${args.join(' ')}`),
      printErr: (...args) => context.log(`[DOSBox] ${args.join(' ')}`),
      setStatus: message => { if (message) context.setLoading(String(message)); },
      onAbort: reason => {
        runtime.state = 'crashed';
        context.log(`DOSBox stopped: ${reason}`);
        context.showRuntime('crashed');
      }
    });
    return runtime.module;
  }

  function progress(context, detail) {
    if (detail.phase === 'checking-cache') context.setLoading(`Checking ${detail.key}…`);
    if (detail.phase === 'downloading') {
      const percent = detail.total ? Math.floor(detail.received * 100 / detail.total) : 0;
      context.setLoading(`Caching ${detail.key} from this container…`, `${percent}%`);
    }
    if (detail.phase === 'restored') context.setLoading(`Restored ${detail.key} from this browser…`);
  }

  globalThis.WasmGameAdapter = Object.freeze({
    async init(context) {
      await loadManifest(context);
      context.elements.canvas.addEventListener('contextmenu', event => event.preventDefault());
    },

    async start(context) {
      if (runtime.started) return;
      runtime.started = true;
      runtime.state = 'loading';
      context.setEngineState('loading');
      try {
        await context.shell.resumeAudio();
        context.setLoading('Preparing Jill of the Jungle…', '', 5);
        const prepared = await context.dataClient.load(ownerData(context), {
          onProgress: detail => progress(context, detail)
        });
        context.setLoading('Loading native DOSBox engine…', '', 55);
        const module = await loadEngine(context);
        context.setLoading('Preparing Jill of the Jungle…', '', 72);
        await context.framework.mountOwnerFiles(module, prepared, {
          root: '/game',
          mode: 'memfs',
          onProgress(detail) {
            if (detail.phase === 'mounting' && detail.total) {
              context.setLoading('Preparing Jill of the Jungle…', `${Math.floor(detail.copied * 100 / detail.total)}%`,
                72 + detail.copied * 20 / detail.total);
            }
          }
        });
        module.FS.chdir('/game');
        context.setLoading('Starting Jill of the Jungle…', runtime.manifest.executable, 98);
        try {
          module.callMain([
            '-c', 'mount c /game',
            '-c', 'c:',
            '-c', runtime.manifest.executable
          ]);
        } catch (error) {
          if (error !== 'unwind') throw error;
        }
        runtime.state = 'gameplay';
        context.showRuntime('gameplay');
        context.elements.canvas.focus();
      } catch (error) {
        runtime.started = false;
        if (runtime.state !== 'crashed') runtime.state = 'launcher';
        throw error;
      }
    },

    readEngineState() { return runtime.state; }
  });
})();
