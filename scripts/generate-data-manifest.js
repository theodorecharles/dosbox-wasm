'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const repo = path.resolve(__dirname, '..');
const sourceRoot = path.resolve(process.env.JILL_DATA_ROOT || '/home/ted/Development/dos/DOS');
const definitions = Object.freeze({
  jill1: Object.freeze({ directory: 'JILL', executable: 'JILL.EXE' }),
  jill2: Object.freeze({ directory: 'JILL2', executable: 'JILL2.EXE' }),
  jill3: Object.freeze({ directory: 'JILL3', executable: 'JILL3.EXE' })
});
const excluded = /^(?:CATALOG\.EXE|HELPME(?:\.DOC|\.EXE)|FILE_ID\.DIZ|EPIC\.ANS|LICENSE\.DOC|ORDER(?:-[A-Z]+)?\.DOC|PRINTME\.BAT|SYSOP\.DOC|VENDOR\.DOC|README\.TXT|JILL[123]\.CFG|JN[123]SAVE.*)$/i;

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const variants = {};
for (const [variant, definition] of Object.entries(definitions)) {
  const directory = path.join(sourceRoot, definition.directory);
  if (!fs.statSync(directory).isDirectory()) throw new Error(`Missing ${directory}`);
  const names = fs.readdirSync(directory).filter(name => {
    const full = path.join(directory, name);
    return fs.statSync(full).isFile() && !excluded.test(name);
  }).sort((left, right) => left.localeCompare(right, 'en', { sensitivity: 'base' }));
  if (!names.includes(definition.executable)) throw new Error(`Missing ${definition.executable}`);
  variants[variant] = {
    namespace: `dosbox-jill-${variant}`,
    version: 'owner-data-2026-08-14-v1',
    executable: definition.executable,
    files: names.map(name => {
      const full = path.join(directory, name);
      return {
        key: name.toLowerCase(),
        name,
        names: [name],
        path: `${variant}/${name}`,
        size: fs.statSync(full).size,
        sha256: sha256(full)
      };
    })
  };
}

const manifest = {
  namespace: 'dosbox-jill-family',
  version: 'owner-data-2026-08-14-v1',
  variants
};
fs.writeFileSync(path.join(repo, 'web', 'wasm-game-data.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote exact Jill owner-data policy with ${Object.values(variants).reduce((sum, entry) => sum + entry.files.length, 0)} files.`);

