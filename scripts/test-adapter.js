#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const web = path.resolve(process.argv[2] || path.join(__dirname, '../web/dist'));
const source = fs.readFileSync(path.join(web, 'game-adapter.js'), 'utf8');
const config = JSON.parse(fs.readFileSync(path.join(web, 'wasm-game.json'), 'utf8'));
const dataManifest = JSON.parse(fs.readFileSync(path.join(web, 'wasm-game-data.json'), 'utf8'));
const expectedFiles = {
  jill1: 28,
  jill2: 27,
  jill3: 34,
  jazz: 66,
  duke1: 55,
  duke2: 7,
  gta: 89,
  nfs: 360,
  simcity2000: 30
};

assert.equal(config.identity, false);
assert.equal(config.graphics, false);
assert.equal(config.pointerLock, false);
assert.equal(config.fullscreen, true);
assert.equal(config.displayMode, '4:3');
for (const [variant, value] of Object.entries(config.variants)) {
  assert.doesNotMatch(value.description, /files?|data|cache|container|directory|folder/i,
    `${variant} ready copy must stay game-focused`);
  assert.ok(value.icon);
  assert.ok(value.pwa?.icons?.length);
  const manifest = dataManifest.variants[variant];
  assert.equal(manifest?.files.length, expectedFiles[variant], `${variant} has the curated file set`);
  assert.ok(manifest.executable);
  assert.ok(manifest.commands.includes(manifest.executable) ||
    manifest.commands.some(command => command.includes(manifest.executable)));
  assert.ok(manifest.commands.every(command => typeof command === 'string' && command.trim()));
  assert.ok(manifest.dosboxArguments.every(argument => typeof argument === 'string' && argument.trim()));
  assert.equal(new Set(manifest.files.map(file => file.key)).size, manifest.files.length);
  assert.equal(new Set(manifest.files.map(file => file.mountName || file.name)).size, manifest.files.length);
  for (const file of manifest.files) {
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
    assert.ok(file.size > 0);
  }
}
assert.deepEqual(Object.keys(config.variants), Object.keys(expectedFiles));
assert.deepEqual(Object.keys(dataManifest.variants), Object.keys(expectedFiles));

async function exercise(variant) {
  const transitions = [];
  const launches = [];
  const loading = [];
  let createdPolicy;
  let loadedPolicy;
  let moduleOptions;
  const canvas = {
    addEventListener() {},
    focus() { launches.push(['focus']); }
  };
  const module = {
    FS: { chdir(directory) { launches.push(['chdir', directory]); } },
    callMain(arguments_) { launches.push(['callMain', Array.from(arguments_)]); throw 'unwind'; }
  };
  const document = {
    createElement(type) { assert.equal(type, 'script'); return {}; },
    head: {
      appendChild(script) {
        assert.equal(script.src, '/dosbox.js');
        sandbox.createDosBoxModule = async options => { moduleOptions = options; return module; };
        queueMicrotask(script.onload);
      }
    }
  };
  const sandbox = {
    console, document,
    crypto: { subtle: { digest: async () => new ArrayBuffer(32) } },
    fetch: async request => {
      assert.equal(request, '/wasm-game-data.json');
      return { ok: true, json: async () => dataManifest };
    }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'game-adapter.js' });
  const adapter = sandbox.WasmGameAdapter;
  const context = {
    variant,
    config: config.variants[variant],
    elements: { canvas },
    framework: {
      createOwnerDataSet(policy) { createdPolicy = policy; return policy; },
      async mountOwnerFiles(currentModule, data, options) {
        assert.equal(currentModule, module);
        assert.equal(data.policy, createdPolicy);
        assert.equal(options.root, '/game');
        assert.equal(options.preservePaths, dataManifest.variants[variant].preservePaths === true);
        launches.push(['mount']);
      }
    },
    dataClient: {
      async load(policy, options) {
        loadedPolicy = policy;
        await assert.rejects(
          policy.files[0].validate({ arrayBuffer: async () => new ArrayBuffer(0) }),
          /failed SHA-256 verification/
        );
        options.onProgress({ phase: 'checking-cache', key: policy.files[0].key });
        options.onProgress({ phase: 'downloading', key: policy.files[0].key, received: 1, total: 2 });
        options.onProgress({ phase: 'restored', key: policy.files[0].key });
        return { policy, entries: policy.files.map(file => ({ policy: file })) };
      }
    },
    shell: { async resumeAudio() {} },
    setLoading(...detail) { loading.push(detail); }, log() {},
    setEngineState(state) { transitions.push(state); },
    showRuntime(state) { transitions.push(state); }
  };

  assert.equal(adapter.readEngineState(), 'launcher');
  await adapter.init(context);
  const pending = adapter.start(context);
  assert.equal(adapter.readEngineState(), 'loading');
  await pending;
  assert.equal(createdPolicy.namespace, dataManifest.variants[variant].namespace);
  assert.deepEqual(createdPolicy.files.map(file => file.mountName),
    dataManifest.variants[variant].files.map(file => file.mountName || file.name));
  assert.equal(loadedPolicy, createdPolicy);
  moduleOptions.setStatus('Mounting owner data from cache');
  assert.doesNotMatch(loading.flat().join('\n'), /files?|data|cache|container|browser|mount|verif|directory|folder|path|engine|\.exe/i,
    'normal loading copy must remain title-focused');
  assert.equal(adapter.readEngineState(), 'gameplay');
  assert.deepEqual(transitions, ['loading', 'gameplay']);
  const invocation = launches.find(call => call[0] === 'callMain');
  assert.ok(invocation);
  assert.deepEqual(invocation[1], [
    ...dataManifest.variants[variant].dosboxArguments,
    ...dataManifest.variants[variant].commands.flatMap(command => ['-c', command])
  ]);
  assert.ok(launches.some(call => call[0] === 'mount'));
  assert.ok(moduleOptions && moduleOptions.canvas === canvas);
  moduleOptions.onAbort('diagnostic stop');
  assert.equal(adapter.readEngineState(), 'crashed');
  assert.equal(transitions.at(-1), 'crashed');
}

(async () => {
  for (const variant of Object.keys(config.variants)) await exercise(variant);
  console.log('DOSBox adapter loading, gameplay, abort, mount, input-policy, display, and PWA contracts passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
