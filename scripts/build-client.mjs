import { build } from 'esbuild'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const result = await build({
  entryPoints: [path.join(root, 'src', 'client', 'index.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  external: ['react', 'react/*'],
  write: false,
  legalComments: 'none',
})
const body = result.outputFiles[0]?.text
if (body === undefined) throw new Error('client bundle did not produce output')
const indented = body.replace(/[ \t]+$/gm, '').split('\n').map(line => line === '' ? '' : '  ' + line).join('\n')
const output = [
  'window.__ModuleLoader__.load({',
  '  id: "dsh-deepcanary",',
  '  factory: (require) => {',
  '    var module = { exports: {} };',
  '    var exports = module.exports;',
  indented,
  '    return module.exports;',
  '  }',
  '});',
  '',
].join('\n')

const lib = path.join(root, 'lib')
// `tsc` emits the typed source tree before this script runs. The browser
// loader consumes only the bundled `./client` entry, so remove the old
// root-level source artifacts and the intermediate `lib/client/` tree. This
// also prevents a previous pre-module `client.js.map` from entering npm.
await Promise.all([
  rm(path.join(lib, 'client'), { recursive: true, force: true }),
  rm(path.join(lib, 'client.d.ts'), { force: true }),
  rm(path.join(lib, 'client.d.ts.map'), { force: true }),
  rm(path.join(lib, 'client.js.map'), { force: true }),
])
await mkdir(lib, { recursive: true })
await writeFile(path.join(lib, 'client.js'), output, 'utf8')
console.log('client bundle written: lib/client.js')
