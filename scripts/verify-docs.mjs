import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

function withoutFences(markdown, file) {
  let fence
  const visible = []
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/)
    if (match) {
      if (!fence) fence = match[1]
      else if (match[1][0] === fence[0] && match[1].length >= fence.length && !match[2].trim()) fence = undefined
      continue
    }
    if (!fence) visible.push(line)
  }
  if (fence) throw new Error(`Unclosed code fence: ${file}`)
  return visible.join('\n')
}

export function documentationLinks(markdown, file) {
  const visible = withoutFences(markdown, file)
  const links = [...visible.matchAll(/!?\[[^\]\n]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g)].map(match => match[1].replace(/^<|>$/g, ''))
  links.push(...[...visible.matchAll(/\b(?:href|src)="([^"]+)"/g)].map(match => match[1].replaceAll('&amp;', '&')))
  return links
}

function anchors(markdown, file) {
  const result = new Set()
  const counts = new Map()
  for (const match of withoutFences(markdown, file).matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
    const slug = match[1].replace(/<[^>]*>/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/\s/g, '-')
    const count = counts.get(slug) ?? 0
    counts.set(slug, count + 1)
    result.add(count ? `${slug}-${count}` : slug)
  }
  for (const match of markdown.matchAll(/\b(?:id|name)="([^"]+)"/g)) result.add(match[1])
  return result
}

export async function verifyDocs(availableFiles) {
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  const files = manifest.files.filter(file => file.endsWith('.md'))
  const documents = new Map(await Promise.all(files.map(async file => [file, await readFile(path.join(root, file), 'utf8') ])))
  for (const [file, markdown] of documents) {
    if (/(?:[CF]:[\\/]Agent_Related|C:[\\/]Users[\\/]Oscar)/i.test(markdown)) throw new Error(`Local workspace path in public documentation: ${file}`)
    if (!file.endsWith('.zh-CN.md')) {
      const counterpart = file.replace(/\.md$/, '.zh-CN.md')
      if (!documents.has(counterpart)) throw new Error(`Missing Chinese document: ${counterpart}`)
      if (!documentationLinks(markdown, file).includes(path.posix.basename(counterpart))) throw new Error(`Missing language navigation: ${file}`)
    }
    for (const target of documentationLinks(markdown, file)) {
      if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(target)) continue
      const [relative, fragment] = target.split('#')
      const resolved = relative ? path.posix.normalize(path.posix.join(path.posix.dirname(file), decodeURIComponent(relative.split('?')[0]))) : file
      if (resolved.startsWith('../') || path.posix.isAbsolute(resolved)) throw new Error(`Documentation link leaves repository: ${file} -> ${target}`)
      await access(path.join(root, resolved)).catch(() => { throw new Error(`Missing documentation target: ${file} -> ${target}`) })
      if (availableFiles && !availableFiles.has(resolved)) throw new Error(`Missing packaged documentation target: ${file} -> ${target}`)
      if (fragment && resolved.endsWith('.md')) {
        const content = documents.get(resolved) ?? await readFile(path.join(root, resolved), 'utf8')
        if (!anchors(content, resolved).has(decodeURIComponent(fragment))) throw new Error(`Missing documentation anchor: ${file} -> ${target}`)
      }
    }
  }
  for (const file of ['README.md', 'README.zh-CN.md', 'CHANGELOG.md', 'CHANGELOG.zh-CN.md']) {
    if (!documents.get(file)?.includes(manifest.version)) throw new Error(`Current version is absent from ${file}`)
  }
  return documents.size
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(`Documentation ok: ${await verifyDocs()} files`)
