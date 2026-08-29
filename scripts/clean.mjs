import { rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
for (const relative of ['lib', 'lib-test', 'coverage']) {
  await rm(path.join(root, relative), { recursive: true, force: true })
}
console.log('cleaned build artifacts')
