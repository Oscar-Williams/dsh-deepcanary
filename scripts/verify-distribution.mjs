import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const required = ['lib/index.js', 'lib/index.d.ts', 'cordis.patch.yml', 'README.md', 'README.en.md', 'CHANGELOG.md', 'LICENSE']

for (const file of required) await access(path.join(root, file))
const entry = await readFile(path.join(root, 'lib/index.js'), 'utf8')
if (!entry.includes("dsh-deepcanary")) throw new Error('lib/index.js does not contain the plugin entry')
if (packageJson.main !== './lib/index.js' || packageJson.types !== './lib/index.d.ts') throw new Error('package entry points are inconsistent')
console.log(`distribution ok: ${packageJson.name}@${packageJson.version}`)
