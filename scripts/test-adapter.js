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
  assert.ok(dataManifest.variants[variant]?.files.length > 20);
}

async function exercise(variant) {
  const transitions = [];
  const launches = [];
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
    elements: { canvas },
    framework: {
      createOwnerDataSet(policy) { createdPolicy = policy; return policy; },
      async mountOwnerFiles(currentModule, data, options) {
        assert.equal(currentModule, module);
        assert.equal(data.policy, createdPolicy);
        assert.equal(options.root, '/game');
        launches.push(['mount']);
      }
    },
    dataClient: {
      async load(policy, options) {
        loadedPolicy = policy;
        options.onProgress({ phase: 'restored', key: policy.files[0].key });
        return { policy, entries: policy.files.map(file => ({ policy: file })) };
      }
    },
    shell: { async resumeAudio() {} },
    setLoading() {}, log() {},
    setEngineState(state) { transitions.push(state); },
    showRuntime(state) { transitions.push(state); }
  };

  assert.equal(adapter.readEngineState(), 'launcher');
  await adapter.init(context);
  const pending = adapter.start(context);
  assert.equal(adapter.readEngineState(), 'loading');
  await pending;
  assert.equal(createdPolicy.namespace, dataManifest.variants[variant].namespace);
  assert.equal(loadedPolicy, createdPolicy);
  assert.equal(adapter.readEngineState(), 'gameplay');
  assert.deepEqual(transitions, ['loading', 'gameplay']);
  const invocation = launches.find(call => call[0] === 'callMain');
  assert.ok(invocation);
  assert.ok(invocation[1].includes(dataManifest.variants[variant].executable));
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
