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
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'

const API_PREFIX = '/api/rich-context'
const ACTION_LIMIT = 2_000_000
const DSH_HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const GLOBAL_FILE = join(DSH_HOME, 'AGENTS.md')
const TEMPLATE_DIR = join(DSH_HOME, 'rich-context', 'templates')
const SESSIONS_DIR = join(DSH_HOME, 'sessions')

export const name = 'dsh-rich-context'
export const inject = ['tools', 'webServer', 'agents', 'systemPrompt']

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
          writeJson(res, 200, {
            ok: true,
            globalPath: GLOBAL_FILE,
            globalContent: readFileOrNull(GLOBAL_FILE),
            workspaces: workspaceSlugs(),
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
              const slug = url.searchParams.get('workspace') ?? ''
              const root = slugToPath(slug)
              if (root === '' || root.includes('..')) { writeJson(res, 400, { ok: false, error: 'invalid-workspace' }); return }
              const path = join(root, 'AGENTS.md')
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
            const root = slugToPath(typeof body.workspace === 'string' ? body.workspace : '')
            if (root === '' || root.includes('..')) { writeJson(res, 400, { ok: false, error: 'invalid-workspace' }); return }
            path = join(root, 'AGENTS.md')
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
