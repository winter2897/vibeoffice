// Rejects the old product/assistant brand names in user-visible code. The suite
// ships as VibeOffice with an assistant called Aide; upstream merges keep
// reintroducing "GenOffice" / "Genspark", so this scan catches them early.
//
// Only the capitalized display spellings are flagged. Lowercase forms are
// deliberately kept and never reported: the @genoffice/* workspace scope, the
// GENOFFICE_* env vars, genspark.ai endpoints, the @genspark/cli dependency,
// and on-disk/symbol identifiers.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

// "GenOffice" here is functional data, not branding: font family/file names,
// user save paths, and keys written into saved PDFs that older files still use.
const DATA_FILES = new Set([
  'apps/docs/src/renderer/line-metrics.ts',
  'apps/docs/src/renderer/fonts/fonts.css',
  'apps/docs/src/renderer/editor/marks.ts',
  'apps/docs/tests/line-metrics.test.ts',
  'apps/docs/tests/kr-font-metrics.test.ts',
  'apps/docs/tests/font-check.test.ts',
  'apps/docs/tests/font-paste-roundtrip.test.ts',
  'apps/docs/tests/word-count.test.ts',
  'apps/pdf/src/main/save-pdf.ts',
  'apps/pdf/src/shared/ipc.ts',
  'apps/pdf/tests/save-pdf.test.ts',
  'apps/sheets/tests/fixture-builder.ts',
  'packages/project-store/tests/store.test.ts',
  'tools/normalize-kr-sans-hmtx.py',
  'tools/check-brand.mjs',
])

// Prefixes whose "Genspark" names the actual backend vendor rather than the
// assistant feature. They go away with the LLM provider swap, not the rebrand.
const VENDOR_PREFIXES = [
  'packages/ai-search/',
  'packages/ai-provider/',
  'packages/agent-core/tests/',
  'packages/electron-utils/src/remote-image.ts',
  'packages/electron-utils/tests/remote-image.test.ts',
]

// Literals that must survive verbatim inside files we otherwise scan: the dev
// userData dirs, whose rename would strand an existing install's settings.
const ALLOWED = ['GenOffice Docs Dev', 'GenOffice Dev']

const SCOPE = /^(apps|packages|e2e|tools)\/.*\.(ts|tsx|css|html|mjs|cjs|json)$/
const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const files = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' }).split('\n')

const violations = []
for (const file of files) {
  if (!SCOPE.test(file) || DATA_FILES.has(file)) continue
  const isVendor = VENDOR_PREFIXES.some((p) => file.startsWith(p))
  const lines = readFileSync(join(repoRoot, file), 'utf8').split('\n')
  lines.forEach((text, i) => {
    let stripped = text
    for (const a of ALLOWED) stripped = stripped.replaceAll(a, '')
    const hit =
      (!DATA_FILES.has(file) && stripped.includes('GenOffice') && 'GenOffice') ||
      (!isVendor && stripped.includes('Genspark') && 'Genspark')
    if (hit) violations.push([`${file}:${i + 1}`, hit, text.trim().slice(0, 100)])
  })
}

if (violations.length === 0) {
  console.log('No old brand names in user-visible code.')
  process.exit(0)
}
console.error(
  'Old brand names found. The product is "VibeOffice" and the assistant is\n' +
    '"Aide". Lowercase identifiers (@genoffice/*, GENOFFICE_*, genspark.ai) are\n' +
    'intentionally unchanged — only the display spellings are rejected.\n',
)
for (const [where, name, text] of violations) console.error(`  ${where}  [${name}]  ${text}`)
process.exit(1)
