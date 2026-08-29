/**
 * dsh-rich-context — Host half.
 *
 * Owns the AGENTS.md management service on the host plane:
 *  - GET  /api/rich-context/state            (workspaces, file contents, templates)
 *  - PUT  /api/rich-context/file             (scope: global | workspace)
 *  - PUT  /api/rich-context/template         (create/update a user template)
 *  - DELETE /api/rich-context/template       (remove a user template)
 *
 * The files managed are exactly what dsh-agent-instructions loads:
 *  - user-global: <DSH_HOME>/AGENTS.md          (injected into every session)
 *  - workspace:   <workspace-root>/AGENTS.md    (per-project, cwd-discovered)
 *
 * Zero runtime dependencies: node builtins only.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync, lstatSync, symlinkSync, readlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'

const API_PREFIX = '/api/rich-context'
const ACTION_LIMIT = 2_000_000
const DSH_HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const GLOBAL_FILE = join(DSH_HOME, 'AGENTS.md')
const TEMPLATE_DIR = join(DSH_HOME, 'rich-context', 'templates')
const SESSIONS_DIR = join(DSH_HOME, 'sessions')
/** Known tool directories that use AGENTS.md — scanned on demand. */
const KNOWN_SOURCES = [
  { dir: '.dsh', label: 'DSH Harness' },
  { dir: '.codex', label: 'Codex CLI' },
  { dir: '.claude', label: 'Claude Code' },
  { dir: '.omp', label: 'OMP' },
  { dir: '.pi', label: 'Pi' },
  { dir: '.cursor', label: 'Cursor' },
  { dir: '.aider', label: 'Aider' },
  { dir: '.gemini', label: 'Gemini' },
  { dir: '.copilot', label: 'Copilot' },
  { dir: '.continue', label: 'Continue' },
]

export const name = 'dsh-rich-context'
export const inject = ['tools', 'webServer']

/** Built-in section templates (insertable titled sections, always available). */
const BUILTIN_TEMPLATES = [
  {
    id: 'builtin:coding-standards',
    name: 'Coding standards',
    section: `## Coding standards

- Prefer the smallest change that solves the problem; no speculative abstraction.
- Name things after what they do, not how they're implemented.
- Every non-obvious decision gets one comment saying WHY, not WHAT.
- Match the file's existing style; do not reformat untouched code.`,
  },
  {
    id: 'builtin:review-checklist',
    name: 'Review checklist',
    section: `## Review checklist

Before claiming any change is done:
- [ ] The exact user workflow works end to end (not just the unit under test).
- [ ] Failure paths verified: invalid input, retries, partial failure, cleanup.
- [ ] No stubs, mocks, or success-shaped responses standing in for real behavior.
- [ ] Docs and comments updated where behavior changed.`,
  },
  {
    id: 'builtin:testing-policy',
    name: 'Testing policy',
    section: `## Testing policy

- Tests prove behavior, not implementation details.
- One focused test per claim; name the claim in the test title.
- Failure-path tests are as important as happy-path tests.
- Benchmarks only with a baseline comparison, same workload and environment.`,
  },
  {
    id: 'builtin:communication',
    name: 'Communication rules',
    section: `## Communication rules

- Lead with the answer or result; details after.
- Plain, direct language; no filler and no hedging.
- Report what was measured, not what was intended.
- When blocked, name the concrete blocker and what would unblock it.`,
  },
  {
    id: 'builtin:language',
    name: 'Language rule',
    section: `## Language

Reply in the language the user is currently writing in. Technical terms,
identifiers, and code stay in their original language.`,
  },
  {
    id: 'builtin:safety-rails',
    name: 'Safety rails',
    section: `## Safety rails

- Never delete or overwrite user data without an explicit instruction naming it.
- Destructive commands require confirmation unless pre-authorized this session.
- Secrets are never echoed, logged, or committed.`,
  },
  {
    id: 'builtin:commit-discipline',
    name: 'Commit discipline',
    section: `## Commit discipline

- One logical change per commit; the message says what and why.
- Never mix refactors with behavior changes.
- Commits build green: no broken intermediate states on shared branches.`,
  },
]

/** List workspace slugs from the sessions directory (each --slug-- dir is a cwd). */
function workspaceSlugs() {
  try {
    return readdirSync(SESSIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('--') && entry.name.endsWith('--'))
      .map((entry) => entry.name.slice(2, -2))
      .sort()
  } catch {
    return []
  }
}

/** Decode a sessions-dir slug back to a filesystem path. */
function slugToPath(slug) {
  const decoded = slug.replaceAll("--", "/")
  return decoded.startsWith("/") ? decoded : `/${decoded}`
}

function readFileOrNull(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

function userTemplates() {
  try {
    return readdirSync(TEMPLATE_DIR)
      .filter((name) => name.endsWith('.md'))
      .map((name) => ({ id: `user:${name.replace(/\.md$/, '')}`, name: name.replace(/\.md$/, '').replaceAll('-', ' '), section: readFileSync(join(TEMPLATE_DIR, name), 'utf8') }))
  } catch {
    return []
  }
}

/** Write one JSON response. */
function writeJson(res, status, body) {
  if (res.writableEnded) return
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

/** Read a bounded JSON request body. */
async function readJsonBody(req, limit) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > limit) throw new Error('body-too-large')
    chunks.push(buffer)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw === '' ? undefined : JSON.parse(raw)
}

/** Route fence (exemplar posture): loopback socket + browser same-origin marker. */
function guard(req, res) {
  const remote = req.socket?.remoteAddress ?? ''
  const loopback = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1'
  const site = req.headers['sec-fetch-site']
  const browser = site === 'same-origin' || typeof req.headers.origin === 'string'
  if (!loopback || !browser) writeJson(res, 403, { ok: false, error: 'forbidden' })
  return loopback && browser
}

export function apply(ctx) {
  ctx.effect(() => {
    const routes = [
      {
        kind: 'exact',
        path: `${API_PREFIX}/state`,
        handler: (req, res) => {
          if (req.method !== 'GET') { writeJson(res, 405, { ok: false, error: 'method-not-allowed' }); return }
          if (!guard(req, res)) return
          // Workspaces as real filesystem paths — scan known parent dirs for repos
          const wsRoots = []
          const scanDirs = ['/home/github', '/home/sysadmin', '/tmp']
          for (const scanDir of scanDirs) {
            if (!existsSync(scanDir)) continue
            try {
              for (const entry of readdirSync(scanDir, { withFileTypes: true })) {
                if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue
                const repoDir = join(scanDir, entry.name)
                // Include if it has AGENTS.md, CLAUDE.md, or is a git repo
                if (existsSync(join(repoDir, 'AGENTS.md')) || existsSync(join(repoDir, 'CLAUDE.md')) || existsSync(join(repoDir, '.git'))) {
                  wsRoots.push(repoDir)
                }
              }
            } catch { /* not readable */ }
          }
          wsRoots.sort()
          writeJson(res, 200, {
            ok: true,
            globalPath: GLOBAL_FILE,
            globalContent: readFileOrNull(GLOBAL_FILE),
            workspaces: wsRoots,
            templates: [...BUILTIN_TEMPLATES, ...userTemplates()],
          })
        },
      },
      {
        kind: 'exact',
        path: `${API_PREFIX}/file`,
        handler: async (req, res) => {
          if (req.method !== 'GET' && req.method !== 'PUT') { writeJson(res, 405, { ok: false, error: 'method-not-allowed' }); return }
          if (!guard(req, res)) return
          if (req.method === 'GET') {
            const url = new URL(req.url ?? '/', 'http://localhost')
            const scope = url.searchParams.get('scope')
            if (scope === 'global') { writeJson(res, 200, { ok: true, path: GLOBAL_FILE, content: readFileOrNull(GLOBAL_FILE) }); return }
            if (scope === 'workspace') {
              const wsPath = url.searchParams.get('workspace') ?? ''
              if (wsPath === '' || !wsPath.startsWith('/') || wsPath.includes('..')) { writeJson(res, 400, { ok: false, error: 'invalid-workspace' }); return }
              const path = join(wsPath, 'AGENTS.md')
              writeJson(res, 200, { ok: true, path, content: readFileOrNull(path) })
              return
            }
            if (scope === 'custom') {
              const customPath = url.searchParams.get('path') ?? ''
              if (customPath === '' || !customPath.startsWith('/') || customPath.includes('..')) { writeJson(res, 400, { ok: false, error: 'invalid-path' }); return }
              writeJson(res, 200, { ok: true, path: customPath, content: readFileOrNull(customPath) })
              return
            }
            writeJson(res, 400, { ok: false, error: 'invalid-scope' })
            return
          }
          if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) { writeJson(res, 415, { ok: false, error: 'json-required' }); return }
          let body
          try { body = await readJsonBody(req, ACTION_LIMIT) } catch (error) {
            writeJson(res, error?.message === 'body-too-large' ? 413 : 400, { ok: false, error: error?.message ?? 'bad-request' })
            return
          }
          if (typeof body !== 'object' || body === null || typeof body.content !== 'string' || (body.scope !== 'global' && body.scope !== 'workspace' && body.scope !== 'custom')) {
            writeJson(res, 400, { ok: false, error: 'invalid-body' })
            return
          }
          let path
          if (body.scope === 'custom') {
            if (typeof body.path !== 'string' || body.path === '' || !body.path.startsWith('/') || body.path.includes('..')) { writeJson(res, 400, { ok: false, error: 'invalid-path' }); return }
            path = body.path
          }
          else if (body.scope === 'global') path = GLOBAL_FILE
          else {
            const wsPath = typeof body.workspace === 'string' ? body.workspace : ''
            if (wsPath === '' || !wsPath.startsWith('/') || wsPath.includes('..')) { writeJson(res, 400, { ok: false, error: 'invalid-workspace' }); return }
            path = join(wsPath, 'AGENTS.md')
          }
          try {
            mkdirSync(dirname(path), { recursive: true })
            writeFileSync(path, body.content, 'utf8')
            writeJson(res, 200, { ok: true, path })
          } catch (error) {
            writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        },
      },
      {
        kind: 'exact',
        path: `${API_PREFIX}/sources`,
        handler: (req, res) => {
          if (req.method !== 'GET') { writeJson(res, 405, { ok: false, error: 'method-not-allowed' }); return }
          if (!guard(req, res)) return
          const home = homedir()
          const sources = []
          const seen = new Set()
          const addSource = (path, label, category) => {
            if (seen.has(path)) return
            seen.add(path)
            const exists = existsSync(path)
            sources.push({ path, label, category, file: path.split('/').pop(), exists, lines: exists ? readFileSync(path, 'utf8').split('\n').length : 0 })
          }

          // 1. Tool config directories — scan BOTH $HOME and /root (operators run as both)
          const homeRoots = [home, '/root'].filter((root, index, arr) => arr.indexOf(root) === index)
          for (const root of homeRoots) {
            const rootLabel = root === home ? '' : ' (root)'
            for (const { dir, label } of KNOWN_SOURCES) {
              for (const file of ['AGENTS.md', 'CLAUDE.md']) {
                addSource(join(root, dir, file), `${label}${rootLabel} (${file})`, 'tool-config')
              }
            }
            // 2. Home root AGENTS.md
            for (const file of ['AGENTS.md', 'CLAUDE.md']) {
              addSource(join(root, file), `Home root${rootLabel} (${file})`, 'home')
            }
          }

          // 3. Direct filesystem scan — workspace roots + .refs/ reference repos.
          // Slug decoding is ambiguous (hyphens in dir names vs separators), so
          // we scan the actual filesystem instead.
          const scanRoots = [
            { dir: '/home/github', label: 'github', depth: 2 },
            { dir: home, label: 'home', depth: 1 },
          ]
          for (const { dir: scanDir, label: scanLabel, depth } of scanRoots) {
            if (!existsSync(scanDir)) continue
            try {
              for (const entry of readdirSync(scanDir, { withFileTypes: true })) {
                if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue
                const repoDir = join(scanDir, entry.name)
                // Repo root AGENTS.md/CLAUDE.md
                for (const file of ['AGENTS.md', 'CLAUDE.md']) {
                  const p = join(repoDir, file)
                  if (existsSync(p)) addSource(p, `${entry.name} (${file})`, 'workspace-root')
                }
                // .refs/ subdirectories (reference repos)
                if (depth >= 2) {
                  const refsDir = join(repoDir, '.refs')
                  if (existsSync(refsDir)) {
                    try {
                      for (const ref of readdirSync(refsDir, { withFileTypes: true })) {
                        if (!ref.isDirectory()) continue
                        for (const file of ['AGENTS.md', 'CLAUDE.md']) {
                          const p = join(refsDir, ref.name, file)
                          if (existsSync(p)) addSource(p, `${entry.name}/.refs/${ref.name} (${file})`, 'reference')
                        }
                        // One level deeper for nested .refs/ (e.g. .refs/networking/netbird)
                        const refSub = join(refsDir, ref.name)
                        try {
                          for (const nested of readdirSync(refSub, { withFileTypes: true })) {
                            if (!nested.isDirectory()) continue
                            for (const file of ['AGENTS.md', 'CLAUDE.md']) {
                              const p = join(refSub, nested.name, file)
                              if (existsSync(p)) addSource(p, `${entry.name}/.refs/${ref.name}/${nested.name} (${file})`, 'reference')
                            }
                          }
                        } catch { /* not readable */ }
                      }
                    } catch { /* not readable */ }
                  }
                }
              }
            } catch { /* not readable */ }
          }

          // Global tab sources: tool-config and home only (workspace files belong to the workspace tab)
          const globalOnly = sources.filter((s) => s.category === 'tool-config' || s.category === 'home')
          globalOnly.sort((a, b) => (b.exists ? 1 : 0) - (a.exists ? 1 : 0) || a.label.localeCompare(b.label))
          sources.length = 0
          sources.push(...globalOnly)

          // Check which is the current default (symlink target)
          let currentDefault = null
          try {
            const stats = lstatSync(GLOBAL_FILE)
            if (stats.isSymbolicLink()) currentDefault = readlinkSync(GLOBAL_FILE)
          } catch { /* not a symlink or doesn't exist */ }
          writeJson(res, 200, { ok: true, sources, currentDefault, globalPath: GLOBAL_FILE })
        },
      },
      {
        kind: 'exact',
        path: `${API_PREFIX}/default`,
        handler: async (req, res) => {
          if (req.method !== 'POST') { writeJson(res, 405, { ok: false, error: 'method-not-allowed' }); return }
          if (!guard(req, res)) return
          if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) { writeJson(res, 415, { ok: false, error: 'json-required' }); return }
          let body
          try { body = await readJsonBody(req, 10_000) } catch (error) {
            writeJson(res, 400, { ok: false, error: error?.message ?? 'bad-request' })
            return
          }
          if (typeof body !== 'object' || body === null || typeof body.target !== 'string') {
            writeJson(res, 400, { ok: false, error: 'target-required' })
            return
          }
          const target = body.target
          if (!target.startsWith('/') || target.includes('..')) { writeJson(res, 400, { ok: false, error: 'invalid-target' }); return }
          try {
            // If reset=true, remove symlink and create a plain file
            if (body.reset === true) {
              if (lstatSync(GLOBAL_FILE).isSymbolicLink?.()) unlinkSync(GLOBAL_FILE)
              if (!existsSync(GLOBAL_FILE)) writeFileSync(GLOBAL_FILE, '', 'utf8')
              writeJson(res, 200, { ok: true, default: null, message: 'Reset to plain file' })
              return
            }
            // Create/replace the symlink: ~/.dsh/AGENTS.md -> target
            if (existsSync(GLOBAL_FILE) || lstatSync(GLOBAL_FILE).isSymbolicLink?.()) {
              try { unlinkSync(GLOBAL_FILE) } catch { /* may not exist */ }
            }
            symlinkSync(target, GLOBAL_FILE)
            writeJson(res, 200, { ok: true, default: target, message: `Symlinked ${GLOBAL_FILE} -> ${target}` })
          } catch (error) {
            writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        },
      },
      {
        kind: 'exact',
        path: `${API_PREFIX}/template`,
        handler: async (req, res) => {
          if (req.method !== 'PUT' && req.method !== 'DELETE') { writeJson(res, 405, { ok: false, error: 'method-not-allowed' }); return }
          if (!guard(req, res)) return
          if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) { writeJson(res, 415, { ok: false, error: 'json-required' }); return }
          let body
          try { body = await readJsonBody(req, ACTION_LIMIT) } catch (error) {
            writeJson(res, error?.message === 'body-too-large' ? 413 : 400, { ok: false, error: error?.message ?? 'bad-request' })
            return
          }
          if (typeof body !== 'object' || body === null || typeof body.id !== 'string' || body.id.startsWith('builtin:')) {
            writeJson(res, 400, { ok: false, error: body?.id?.startsWith?.('builtin:') ? 'builtin-template-immutable' : 'invalid-body' })
            return
          }
          const name = body.id.replace(/^user:/, '').replaceAll(' ', '-')
          if (name === '' || name.includes('/') || name.includes('..')) { writeJson(res, 400, { ok: false, error: 'invalid-template-id' }); return }
          const path = join(TEMPLATE_DIR, `${name}.md`)
          try {
            if (req.method === 'DELETE') {
              if (existsSync(path)) unlinkSync(path)
              writeJson(res, 200, { ok: true })
            } else {
              if (typeof body.section !== 'string' || body.section.trim() === '') { writeJson(res, 400, { ok: false, error: 'section-required' }); return }
              mkdirSync(TEMPLATE_DIR, { recursive: true })
              writeFileSync(path, body.section, 'utf8')
              writeJson(res, 200, { ok: true, id: `user:${name}` })
            }
          } catch (error) {
            writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        },
      },
    ]
    const disposers = routes.map((route) => ctx.webServer.register(route))
    return () => {
      for (const dispose of disposers.reverse()) dispose()
    }
  }, 'rich-context: file + template routes')
}
