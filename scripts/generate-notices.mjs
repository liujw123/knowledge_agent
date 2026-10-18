import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputFile = path.join(root, 'THIRD_PARTY_NOTICES.md')

const raw = execSync('pnpm licenses list --prod --json', {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024
})

const groups = JSON.parse(raw)
const licenses = Object.keys(groups).sort((a, b) => a.localeCompare(b))
const total = Object.values(groups).reduce((sum, packages) => sum + packages.length, 0)
const generatedAt = new Date().toISOString().slice(0, 10)

const lines = [
  '# Third-Party Notices',
  '',
  'This project includes the following third-party production dependencies.',
  `Generated from \`pnpm licenses list --prod\` on ${generatedAt}.`,
  '',
  `Total packages: ${total}`,
  '',
  '> Full license texts are distributed with the corresponding packages in',
  '> `node_modules`. If you redistribute a built artifact, keep this file and',
  '> preserve the license notices required by the applicable licenses.',
  ''
]

for (const license of licenses) {
  const packages = groups[license].sort((a, b) => a.name.localeCompare(b.name))
  lines.push(`## ${license}`, '')
  for (const pkg of packages) {
    const version = Array.isArray(pkg.versions) ? pkg.versions.join(', ') : pkg.version || ''
    lines.push(`- \`${pkg.name}${version ? `@${version}` : ''}\``)
  }
  lines.push('')
}

fs.writeFileSync(outputFile, `${lines.join('\n').trim()}\n`, 'utf8')
console.log(`Wrote ${path.relative(root, outputFile)} (${total} packages)`)
