/**
 * Locale meta spec for the Plugins-page display contract (dsh app-boot
 * `package-meta`): `locale/en.json` anchors the localization, every
 * `locale/*.json` must be reachable through the exports glob, and
 * `meta.title` / `meta.description` must be non-empty strings.
 */
// NOTE: do NOT turn the line below into a triple-slash `reference types=node`
// directive — @types/node inclusion is program-global and flips DOM setTimeout
// to the NodeJS.Timeout overload, which breaks two src files. TS 6 has no
// automatic @types inclusion and this repo's tsconfig keeps no `types` field,
// so the bare specifier is unresolved at typecheck time on purpose; vitest
// runs this spec through esbuild, which needs no types.
// @ts-expect-error node:fs is intentionally untyped in this program (see note above)
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The template literal is load-bearing: vitest's jsdom pipeline rewrites the
// bare `new URL('..', import.meta.url)` asset idiom into a dev-server URL
// (http://localhost:3000/...), which node:fs rejects. Interpolating through a
// string breaks the idiom and keeps the real file:// URL.
const root = new URL('..', `${import.meta.url}`)

type LocaleMeta = { meta?: { title?: unknown; description?: unknown } }

function readJson(relative: string): LocaleMeta {
  return JSON.parse(readFileSync(new URL(relative, root), 'utf8')) as LocaleMeta
}

function nonEmpty(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== ''
}

describe('locale meta (Plugins-page display contract)', () => {
  it('ships exactly en.json and zh.json as language files', () => {
    expect(readdirSync(new URL('locale/', root)).sort()).toEqual(['en.json', 'zh.json'])
  })

  it('keeps meta.title and meta.description non-empty in every language', () => {
    for (const language of ['en', 'zh']) {
      const meta = readJson(`locale/${language}.json`).meta
      expect(meta, `${language}: meta`).toBeTypeOf('object')
      expect(nonEmpty(meta?.title), `${language}: meta.title non-empty`).toBe(true)
      expect(nonEmpty(meta?.description), `${language}: meta.description non-empty`).toBe(true)
    }
  })

  it('exports the locale glob and ships the directory in files', () => {
    const pkg = readJson('package.json') as LocaleMeta & {
      exports?: Record<string, unknown>
      files?: string[]
    }
    expect(pkg.exports?.['./locale/*.json']).toBe('./locale/*.json')
    expect(pkg.files).toContain('locale/')
  })
})
