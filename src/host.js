/**
 * dsh-rich-context — Host half.
 *
 * Owns the AGENTS.md management service on the host plane:
 *  - GET  /api/rich-context/state            (workspaces, file contents, templates)
 *  - PUT  /api/rich-context/file             (scope: global | workspace)
 *  - PUT  /api/rich-context/template         (create/update a user template)
 *  - DELETE /api/rich-context/template       (remove a user template)
 *
 * Plus the subagent-persona service ("Agents" tab, v0.2):
 *  - GET    /api/rich-context/agents         (persona roster, route validation state)
 *  - GET    /api/rich-context/agents/file    (one persona TOML, parsed + raw)
 *  - PUT    /api/rich-context/agents/file    (validate + write TOML + compile preset)
 *  - DELETE /api/rich-context/agents/file    (remove TOML + managed preset)
 *  - GET    /api/rich-context/agents/catalog (providers → models → efforts)
 *  - GET    /api/rich-context/agents/import  (foreign agent files, converted preview)
 *  - POST   /api/rich-context/agents/import  (copy + convert selected foreign files)
 *  - POST   /api/rich-context/agents/launch  (spawn a session running a persona)
 *
 * Persona model (research-locked 2026-08-26, operator survey):
 *  - One Codex-style TOML per agent in <DSH_HOME>/agents/<id>.toml:
 *    name, description, provider, model, effort, sandbox_mode,
 *    developer_instructions (the persona / system prompt).
 *  - Every agent carries the full DSH route triple {provider, model,
 *    reasoningEffort} — saved values are validated against the live model
 *    catalog (the same source the GUI model picker uses).
 *  - Each persona compiles to a DSH agent preset at
 *    <DSH_HOME>/.agent-presets/<id>/ (standard composition with the persona
 *    row replaced) so sessions can be composed from it; the preset directory
 *    carries a marker file so the plugin only ever manages its own.
 *  - Launch creates a real standard session with the full route triple via the
 *    seed request/header mechanism + preset mount (the path memory-evolve's
 *    spawner uses), then dispatches the prompt as the first user message.
 *
 * The files managed are exactly what dsh-agent-instructions loads:
 *  - user-global: <DSH_HOME>/AGENTS.md          (injected into every session)
 *  - workspace:   <workspace-root>/AGENTS.md    (per-project, cwd-discovered)
 *
 * Zero runtime dependencies: node builtins only.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync, lstatSync, symlinkSync, readlinkSync, rmSync, realpathSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'

const API_PREFIX = '/api/rich-context'
const ACTION_LIMIT = 2_000_000
const DSH_HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const GLOBAL_FILE = join(DSH_HOME, 'AGENTS.md')
const TEMPLATE_DIR = join(DSH_HOME, 'rich-context', 'templates')
const SESSIONS_DIR = join(DSH_HOME, 'sessions')

// ── Subagent personas ────────────────────────────────────────────────────────
/** Persona TOML directory (one file per agent). */
const AGENTS_DIR = join(DSH_HOME, 'agents')
/** DSH user preset root — where compiled persona presets live. */
const PRESET_ROOT = join(DSH_HOME, '.agent-presets')
/** Preset id rule, copied from @deepseek-ai/dsh-agent-presets PRESET_ID. */
const PRESET_ID_RE = /^[a-z0-9][a-z0-9-]*$/
/** Marker file naming a preset directory as managed by this plugin. */
const PRESET_MARKER = '.dsh-agents.json'
/** Shipped preset roots (first existing wins as the composition template source). */
const SHIPPED_PRESET_ROOTS = [
  join(DSH_HOME, 'source/current/apps/cli/config/agent-presets'),
  '/opt/cli-dsh-web/node_modules/@deepseek-ai/dsh/config/agent-presets',
]
/** Foreign agent-file directories offered by the importer. */
const IMPORT_DIRS = [
  { dir: join(homedir(), '.codex', 'agents'), format: 'toml', label: 'Codex' },
  { dir: '/root/.codex/agents', format: 'toml', label: 'Codex (root)' },
  { dir: join(homedir(), '.claude', 'agents'), format: 'md', label: 'Claude Code' },
  { dir: '/root/.claude/agents', format: 'md', label: 'Claude Code (root)' },
  { dir: join(homedir(), '.gemini', 'agents'), format: 'md', label: 'Gemini CLI' },
  { dir: '/root/.gemini/agents', format: 'md', label: 'Gemini CLI (root)' },
]
/** All effort spellings seen across the 11 researched CLIs, normalized to `effort`. */
const EFFORT_KEYS = ['effort', 'model_reasoning_effort', 'reasoningEffort', 'thoughtLevel']
/** Codex `ultra` has no DSH counterpart on any configured adapter; map to the nearest. */
const EFFORT_ALIASES = { ultra: 'max' }
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

// ── Subagent personas: TOML subset ───────────────────────────────────────────
/**
 * Parse the persona TOML subset: root-level `key = value` pairs with basic
 * strings, multiline basic strings ("""..."""), literal strings ('...'), bare
 * scalars (true/false/numbers). Keys under [tables] are tracked but not
 * returned (Codex files carry [mcp_servers.*] config layers we deliberately
 * do not own). Lenient by design: every competitor skips-and-diagnoses rather
 * than crashes on files it cannot fully understand.
 */
function parseToml(text) {
  const root = {}
  const lines = String(text ?? '').split('\n')
  let table = ''
  let i = 0
  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.trim()
    i += 1
    if (line === '' || line.startsWith('#')) continue
    if (line.startsWith('[') && line.endsWith(']')) { table = line.slice(1, -1).trim(); continue }
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim().replace(/^["']|["']$/g, '')
    let rest = line.slice(eq + 1).trim()
    if (rest.startsWith('"""')) {
      // Multiline basic string — may close on this line or many lines later.
      let inner = rest.slice(3)
      const closeAt = inner.indexOf('"""')
      if (closeAt >= 0) {
        if (table === '') root[key] = decodeTomlString(inner.slice(0, closeAt))
        continue
      }
      const parts = [inner.replace(/^\r?\n/, '')]
      let closed = false
      while (i < lines.length && !closed) {
        const next = lines[i]
        i += 1
        const at = next.indexOf('"""')
        if (at >= 0) { parts.push(next.slice(0, at)); closed = true }
        else parts.push(next)
      }
      if (table === '') root[key] = decodeTomlString(parts.join('\n')).replace(/^\n/, '').replace(/\n$/, '')
      continue
    }
    if (rest.startsWith('"')) {
      // Single-line basic string — first to last quote on the line.
      const last = rest.lastIndexOf('"')
      if (last > 0 && table === '') root[key] = decodeTomlString(rest.slice(1, last))
      continue
    }
    if (rest.startsWith("'")) {
      const end = rest.indexOf("'", 1)
      if (end > 0 && table === '') root[key] = rest.slice(1, end)
      continue
    }
    // Bare scalar — strip trailing comment; keys inside [tables] are skipped
    // (Codex config layers like [mcp_servers.*] are not ours to own).
    if (table !== '') continue
    const hash = rest.indexOf('#')
    root[key] = (hash >= 0 ? rest.slice(0, hash) : rest).trim()
  }
  return root
}

/** Decode TOML basic-string escapes. */
function decodeTomlString(text) {
  return String(text)
    .replace(/\\(["\\])/g, '$1')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
}

/** Escape a value for a TOML single-line basic string. */
function encodeTomlBasic(value) {
  return `"${String(value ?? '').replace(/[\\]/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ')}"`
}

/** Serialize the persona TOML in canonical field order. */
function serializeToml(agent, provenance) {
  const head = provenance ? `# imported-from: ${provenance}\n` : ''
  const body = String(agent.prompt ?? '')
    .replace(/[\\]/g, '\\\\')
    .replace(/"""/g, '\\"\\"\\"')
  return `${head}name = ${encodeTomlBasic(agent.name ?? agent.id)}
description = ${encodeTomlBasic(agent.description ?? '')}
provider = ${encodeTomlBasic(agent.provider ?? '')}
model = ${encodeTomlBasic(agent.model ?? '')}
effort = ${encodeTomlBasic(agent.effort ?? 'default')}
sandbox_mode = ${encodeTomlBasic(agent.sandbox ?? 'read-only')}
developer_instructions = """
${body}
"""
`
}

/** Parse a Claude/Gemini-style agent markdown file: frontmatter + body prompt. */
function parseMdAgent(text) {
  const lines = String(text ?? '').split('\n')
  if (lines[0]?.trim() !== '---') return null
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---')
  if (end <= 0) return null
  const meta = {}
  for (const line of lines.slice(1, end)) {
    const match = /^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/.exec(line)
    if (match === null) continue
    let value = match[2].trim()
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) value = value.slice(1, -1)
    meta[match[1]] = value
  }
  const prompt = lines.slice(end + 1).join('\n').trim()
  const effortKey = EFFORT_KEYS.find((key) => meta[key] !== undefined && meta[key] !== '')
  let model = String(meta.model ?? '').trim()
  // Cursor inline route params: model[effort=high,...]
  let inlineEffort
  const bracket = /\[([^\]]*)\]\s*$/.exec(model)
  if (bracket !== null) {
    model = model.slice(0, bracket.index).trim()
    const effort = /effort=([a-z]+)/i.exec(bracket[1])
    if (effort !== null) inlineEffort = effort[1]
  }
  // OpenCode/Amp vendor-prefixed model ids: provider/model-id
  let provider = String(meta.provider ?? '').trim()
  if (provider === '' && model.includes('/')) {
    const slash = model.indexOf('/')
    provider = model.slice(0, slash)
    model = model.slice(slash + 1)
  }
  return {
    name: String(meta.name ?? '').trim(),
    description: String(meta.description ?? '').trim(),
    provider,
    model,
    effort: inlineEffort ?? (effortKey !== undefined ? meta[effortKey] : ''),
    sandbox: String(meta.sandbox_mode ?? 'read-only'),
    prompt,
  }
}

/** Normalize the five effort spellings + aliases to one canonical value. */
function normalizeEffort(raw) {
  const value = String(raw ?? '').trim()
  if (value === '') return 'default'
  return EFFORT_ALIASES[value] ?? value
}

/** Turn a foreign file stem into a legal preset id. */
function buildAgentId(stem) {
  const id = String(stem ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
  if (id === '') return 'agent'
  return id
}

/** Read one persona TOML into the normalized agent shape. */
function readAgentFile(file) {
  const raw = readFileOrNull(file)
  if (raw === null) return null
  let parsed
  try { parsed = parseToml(raw) } catch { return null }
  const stem = file.split('/').pop().replace(/\.toml$/, '')
  const effortKey = EFFORT_KEYS.find((key) => parsed[key] !== undefined && String(parsed[key]).trim() !== '')
  return {
    id: stem,
    file,
    name: String(parsed.name ?? stem).trim(),
    description: String(parsed.description ?? '').trim(),
    provider: String(parsed.provider ?? '').trim(),
    model: String(parsed.model ?? '').trim(),
    effort: normalizeEffort(effortKey !== undefined ? parsed[effortKey] : 'default'),
    sandbox: String(parsed.sandbox_mode ?? 'read-only').trim(),
    prompt: String(parsed.developer_instructions ?? parsed.prompt ?? '').trim(),
  }
}

// ── Subagent personas: model catalog ─────────────────────────────────────────
/** Catalog cache: providers → models → efforts, from the live llm/settings services. */
let _catalogCache = { at: 0, value: null }

function getPath(root, path) {
  let node = root
  for (const key of path) {
    if (node === null || typeof node !== 'object') return undefined
    node = node[key]
  }
  return node
}

async function buildCatalog(ctx) {
  if (_catalogCache.value !== null && Date.now() - _catalogCache.at < 60_000) return _catalogCache.value
  const providers = {}
  const llm = typeof ctx?.get === 'function' ? ctx.get('llm') : undefined
  const settings = typeof ctx?.get === 'function' ? ctx.get('settings') : undefined
  if (llm !== undefined && typeof llm.listConfigurableProviders === 'function') {
    const entries = llm.listConfigurableProviders() ?? []
    await Promise.all(entries.map(async (entry) => {
      const providerId = String(entry.provider ?? '')
      if (providerId === '') return
      let profile
      try {
        const value = settings.get(entry.settingsNs)
        profile = Array.isArray(entry.settingsPath) && entry.settingsPath.length > 0 ? getPath(value, entry.settingsPath) : value
      } catch { profile = undefined }
      const rawModels = profile !== undefined && Array.isArray(profile.models)
        ? profile.models
        : profile?.[providerId]?.models !== undefined && Array.isArray(profile[providerId].models)
          ? profile[providerId].models
          : []
      const models = {}
      for (const rawModel of rawModels) {
        const id = String(rawModel?.id ?? '')
        if (id === '') continue
        const efforts = new Set()
        let defaultEffort
        const staticMap = rawModel.reasoningEfforts
        if (staticMap !== null && typeof staticMap === 'object') {
          for (const key of Object.keys(staticMap)) efforts.add(key)
        }
        if (efforts.size === 0 && typeof llm.resolveModelInfo === 'function') {
          try {
            const info = await llm.resolveModelInfo(providerId, id)
            for (const effort of info?.reasoning?.efforts ?? []) efforts.add(String(effort.id))
            if (info?.reasoning?.defaultEffort !== undefined) defaultEffort = String(info.reasoning.defaultEffort)
          } catch { /* no adapter metadata — model has no effort list */ }
        }
        models[id] = {
          name: typeof rawModel?.name === 'string' && rawModel.name !== '' ? rawModel.name : id,
          efforts: [...efforts],
          defaultEffort,
        }
      }
      providers[providerId] = {
        label: typeof entry.displayName === 'string' && entry.displayName !== '' ? entry.displayName : providerId,
        models,
      }
    }))
  }
  let defaultRoute = null
  try {
    const selection = typeof ctx?.get === 'function' ? ctx.get('agentDefaultModel')?.currentSelection?.() : undefined
    if (selection?.provider !== undefined && selection?.model !== undefined) {
      defaultRoute = { provider: selection.provider, model: selection.model, ...(selection.reasoningEffort !== undefined ? { effort: selection.reasoningEffort } : {}) }
    }
  } catch { /* default-model service absent */ }
  const value = { providers, defaultRoute }
  _catalogCache = { at: Date.now(), value }
  return value
}

/** Validate a route triple against the catalog. `effort` may be 'default'. */
function validateRoute(catalog, provider, model, effort) {
  const providerEntry = catalog.providers[String(provider ?? '')]
  if (providerEntry === undefined) return { ok: false, error: `unknown provider "${provider ?? ''}"` }
  const modelEntry = providerEntry.models[String(model ?? '')]
  if (modelEntry === undefined) return { ok: false, error: `model "${model ?? ''}" is not in provider "${provider}"` }
  if (modelEntry.efforts.length === 0) {
    if (effort !== 'default') return { ok: false, error: `model "${model}" supports no reasoning efforts — use "default"` }
    return { ok: true }
  }
  if (effort === 'default') {
    return { ok: false, error: `model "${model}" requires an explicit effort (one of: ${modelEntry.efforts.join(', ')})` }
  }
  if (!modelEntry.efforts.includes(effort)) {
    return { ok: false, error: `effort "${effort}" is not supported by ${provider}/${model} (supported: ${modelEntry.efforts.join(', ')})` }
  }
  return { ok: true }
}

/** Find the provider that owns a model id, if any. */
function resolveProviderForModel(catalog, model) {
  for (const [provider, entry] of Object.entries(catalog.providers)) {
    if (entry.models[String(model ?? '')] !== undefined) return provider
  }
  return ''
}

// ── Subagent personas: preset compiler ───────────────────────────────────────
let _standardComposition = null

/** Read the shipped `standard` composition once (persona splice template). */
function standardComposition() {
  if (_standardComposition !== null) return _standardComposition
  for (const root of SHIPPED_PRESET_ROOTS) {
    const text = readFileOrNull(join(root, 'standard', 'agent.cordis.yml'))
    if (text !== null) {
      _standardComposition = { text, source: join(root, 'standard') }
      return _standardComposition
    }
  }
  return null
}

/** Indent persona prose into a 6-space YAML block scalar under `text: >-`. */
function personaRow(personaText) {
  const lines = String(personaText ?? '').replace(/\r/g, '').split('\n')
  const indented = lines.map((line) => (line.trim() === '' ? '' : `      ${line}`)).join('\n')
  return `- id: persona\n  name: '@deepseek-ai/dsh-persona'\n  config:\n    text: >-\n${indented}\n`
}

/**
 * Compile an agent.cordis.yml: the shipped standard composition with its
 * persona row replaced by this agent's prompt. When the shipped file cannot
 * be read, fall back to a minimal verified row set (bash/fs/search/skills/
 * goals/ask/todo/web) and log once.
 */
function compileComposition(agent) {
  const standard = standardComposition()
  const row = personaRow(agent.prompt)
  if (standard !== null) {
    const text = standard.text
    const start = text.indexOf('\n- id: persona\n')
    if (start >= 0) {
      const after = text.indexOf('\n- id: ', start + 1)
      if (after > start) {
        return `${text.slice(0, start + 1)}${row}${text.slice(after + 1)}`
      }
    }
    console.warn('[dsh-rich-context] standard composition lacks a spliceable persona row; using minimal fallback')
  }
  return `# Compiled by dsh-rich-context (minimal fallback composition).\n${row}- id: agent-instructions\n  name: '@deepseek-ai/dsh-agent-instructions'\n  config:\n    maxBytes: 65536\n\n- id: tool-bash\n  name: '@deepseek-ai/dsh-tool-bash'\n\n- id: tool-fs\n  name: '@deepseek-ai/dsh-tool-fs'\n\n- id: tool-fs-search\n  name: '@deepseek-ai/dsh-tool-fs-search'\n  config:\n    sampleOverCapGlobResults: false\n\n- id: skill-filesystem\n  name: '@deepseek-ai/dsh-skill-filesystem'\n\n- id: tool-skill\n  name: '@deepseek-ai/dsh-tool-skill'\n\n- id: tool-goal\n  name: '@deepseek-ai/dsh-tool-goal'\n\n- id: tool-ask-user\n  name: '@deepseek-ai/dsh-tool-ask-user'\n\n- id: tool-todo\n  name: '@deepseek-ai/dsh-tool-todo'\n\n- id: tool-web\n  name: '@deepseek-ai/dsh-tool-web'\n`
}

function markerPath(id) { return join(PRESET_ROOT, id, PRESET_MARKER) }

function isManagedPreset(id) {
  try { return existsSync(markerPath(id)) } catch { return false }
}

/** Write/refresh the compiled preset directory for one agent. */
function writePreset(agent) {
  const dir = join(PRESET_ROOT, agent.id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'agent.cordis.yml'), compileComposition(agent), 'utf8')
  const meta = [`name: ${JSON.stringify(agent.name || agent.id)}`, `description: ${JSON.stringify(agent.description || `Subagent persona ${agent.id}`)}`, 'order: 50'].join('\n')
  writeFileSync(join(dir, 'preset.yml'), `${meta}\n`, 'utf8')
  writeFileSync(join(dir, PRESET_MARKER), JSON.stringify({ managedBy: 'dsh-rich-context', sourceFile: agent.file ?? join(AGENTS_DIR, `${agent.id}.toml`), syncedAt: Date.now() }, null, 2), 'utf8')
  return dir
}

/** Remove a managed preset directory. Refuses presets without our marker. */
function removePreset(id) {
  if (!PRESET_ID_RE.test(id)) return { ok: false, error: 'invalid-preset-id' }
  if (!isManagedPreset(id)) return { ok: false, error: 'not-managed' }
  rmSync(join(PRESET_ROOT, id), { recursive: true, force: true })
  return { ok: true }
}

/** Ids this plugin must never write: shipped roster + foreign user presets. */
function reservedIds() {
  const ids = new Set(['standard', 'code', 'cordis', 'minimal'])
  for (const root of SHIPPED_PRESET_ROOTS) {
    try {
      for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (entry.isDirectory() && PRESET_ID_RE.test(entry.name)) ids.add(entry.name)
      }
    } catch { /* root absent */ }
  }
  try {
    for (const entry of readdirSync(PRESET_ROOT, { withFileTypes: true })) {
      if (entry.isDirectory() && PRESET_ID_RE.test(entry.name) && !isManagedPreset(entry.name)) ids.add(entry.name)
    }
  } catch { /* root absent */ }
  return ids
}

function listAgentFiles() {
  try {
    return readdirSync(AGENTS_DIR)
      .filter((name) => name.endsWith('.toml'))
      .map((name) => join(AGENTS_DIR, name))
      .sort()
  } catch { return [] }
}

/** Roster with live route validation against the catalog. */
function listAgents(catalog) {
  return listAgentFiles().map((file) => {
    const agent = readAgentFile(file)
    if (agent === null) return { id: file.split('/').pop().replace(/\.toml$/, ''), file, broken: true }
    const route = agent.provider === '' || agent.model === ''
      ? { ok: false, error: 'route incomplete — provider and model are required' }
      : validateRoute(catalog, agent.provider, agent.model, agent.effort)
    return { ...agent, routeOk: route.ok, routeError: route.ok ? null : route.error, presetDir: join(PRESET_ROOT, agent.id), presetSynced: isManagedPreset(agent.id) }
  })
}

/** Import candidates from foreign agent directories (deduped by real path). */
function importCandidates(catalog) {
  const seen = new Set()
  const existing = new Set(listAgentFiles().map((file) => file.split('/').pop().replace(/\.toml$/, '')))
  const candidates = []
  for (const source of IMPORT_DIRS) {
    let files = []
    try { files = readdirSync(source.dir).filter((name) => (source.format === 'toml' ? name.endsWith('.toml') : name.endsWith('.md'))) } catch { continue }
    for (const name of files.sort()) {
      const path = join(source.dir, name)
      let real = path
      try { real = realpathSync(path) } catch { /* keep path */ }
      if (seen.has(real)) continue
      seen.add(real)
      const stem = name.replace(/\.(toml|md)$/, '')
      const text = readFileOrNull(path)
      if (text === null) continue
      const parsed = source.format === 'toml' ? parseToml(text) : parseMdAgent(text)
      if (parsed === null || String(parsed.developer_instructions ?? parsed.prompt ?? '').trim() === '') continue
      const id = buildAgentId(stem)
      let provider = String(parsed.provider ?? '').trim()
      if (provider === '') provider = resolveProviderForModel(catalog, String(parsed.model ?? ''))
      const effortKey = EFFORT_KEYS.find((key) => parsed[key] !== undefined && String(parsed[key]).trim() !== '')
      candidates.push({
        path,
        real,
        source: source.label,
        format: source.format,
        id,
        exists: existing.has(id),
        name: String(parsed.name ?? stem).trim() || id,
        description: String(parsed.description ?? '').trim(),
        provider,
        model: String(parsed.model ?? '').trim(),
        effort: normalizeEffort(effortKey !== undefined ? parsed[effortKey] : 'default'),
        sandbox: String(parsed.sandbox_mode ?? 'read-only').trim(),
        prompt: String(parsed.developer_instructions ?? parsed.prompt ?? '').trim(),
      })
    }
  }
  return candidates
}

// ── Subagent personas: launch (session spawn with the full route triple) ─────
/** DSH session id format, matching the GUI. */
function newAgentSessionId() { return `session-${randomUUID()}` }

/** One user message, the same shape the composer sends. */
function launchMessage(text) {
  return { role: 'user', id: randomUUID(), content: [{ type: 'text', text: String(text) }], source: { kind: 'user' } }
}

const ATTACH_DELAYS = [0, 300, 1200, 4000]

async function attachWorkspace(ctx, sessionId, cwd) {
  const registry = typeof ctx?.get === 'function' ? ctx.get('workspaceRegistry') : undefined
  if (registry === undefined) return { ok: false, error: 'workspace service unavailable', attempts: 0 }
  let lastError = 'unknown error'
  for (let attempt = 0; attempt < ATTACH_DELAYS.length; attempt += 1) {
    if (attempt > 0 && ATTACH_DELAYS[attempt] > 0) await new Promise((resolve) => setTimeout(resolve, ATTACH_DELAYS[attempt]))
    try {
      let workspace = await registry.resolveByPath(cwd)
      if (workspace === undefined) workspace = await registry.create(cwd)
      await workspace.attachSession(sessionId)
      return { ok: true, workspaceId: workspace.id, workspaceTitle: workspace.title, attempts: attempt + 1 }
    } catch (error) {
      const code = error?.code ?? error?.cause?.code
      if (code === 'ENOENT' || code === 'ENOTDIR') return { ok: false, error: `cwd does not exist: ${cwd}`, attempts: attempt + 1, skipped: true }
      lastError = error instanceof Error ? error.message : String(error)
    }
  }
  return { ok: false, error: lastError, attempts: ATTACH_DELAYS.length }
}

/**
 * Spawn a real session running one persona: seed request/header carries the
 * full route triple (provider+model+reasoningEffort), the compiled preset is
 * mounted through the agentPresets service, the workspace is attached, and
 * the prompt is dispatched as the first user message.
 */
async function launchPersona(ctx, { agent, prompt, cwd }) {
  const text = String(prompt ?? '').trim()
  if (text === '') return { ok: false, error: 'prompt-required' }
  const catalog = await buildCatalog(ctx)
  const route = validateRoute(catalog, agent.provider, agent.model, agent.effort)
  if (!route.ok) return { ok: false, error: `route invalid: ${route.error}` }
  const workingDir = String(cwd ?? '').trim() !== '' ? String(cwd).trim() : join(homedir())
  if (!workingDir.startsWith('/') || workingDir.includes('..')) return { ok: false, error: 'invalid-cwd' }

  let presetSetup = null
  try {
    const presets = typeof ctx?.get === 'function' ? ctx.get('agentPresets') : undefined
    if (presets !== undefined && typeof presets.resolve === 'function' && typeof presets.mount === 'function') {
      const resolved = await presets.resolve(agent.id)
      const presetId = String(resolved?.id ?? '').trim() || agent.id
      presetSetup = {
        id: presetId,
        setup: async (agentCtx) => { await presets.mount(agentCtx, presetId) },
      }
    }
  } catch (error) {
    console.warn(`[dsh-rich-context] agentPresets resolve failed (launching without explicit mount): ${error instanceof Error ? error.message : String(error)}`)
  }

  const sessionId = newAgentSessionId()
  const seed = [{
    type: 'request/header',
    seq: 0,
    time: Date.now(),
    data: {
      header: {
        config: {
          provider: agent.provider,
          model: agent.model,
          ...(agent.effort !== 'default' ? { reasoningEffort: agent.effort } : {}),
        },
      },
      reason: 'initial',
    },
  }]
  let handle
  try {
    handle = await ctx.agents.create({
      sessionId,
      agentOptions: { provider: agent.provider, model: agent.model },
      meta: { cwd: workingDir, ...(presetSetup !== null ? { agentPreset: presetSetup.id } : { agentPreset: agent.id }) },
      ...(presetSetup !== null ? { setup: presetSetup.setup } : {}),
      seed,
    })
  } catch (error) {
    return { ok: false, error: `session create failed: ${error instanceof Error ? error.message : String(error)}` }
  }
  const attach = await attachWorkspace(ctx, sessionId, workingDir)
  try {
    handle.agent.followup(launchMessage(text))
  } catch (error) {
    return { ok: false, error: `dispatch failed: ${error instanceof Error ? error.message : String(error)}`, sessionId }
  }
  return {
    ok: true,
    sessionId,
    provider: agent.provider,
    model: agent.model,
    effort: agent.effort,
    agentPreset: presetSetup?.id ?? agent.id,
    cwd: workingDir,
    attach,
  }
}

// ── Subagent personas: one-shot delegation (true subagents) ──────────────────
/**
 * Operator correction 2026-08-27: personas must run as SUBAGENTS — in-process
 * children of the calling agent whose final output returns inline — not as
 * separate sidebar sessions. The carrier is the `ctx.subagents` service:
 * SubagentStartRequest carries per-child `persona` (applied as a scoped
 * `deployment:persona` section by dsh-subagent's applyChildComposition),
 * `agentOptions` {provider, model}, and `toolFilter`.
 *
 * Effort has no official field on that path (AgentOptions lacks
 * reasoningEffort and the workflow seam rejects it loudly), but the in-process
 * driver restores a child's request config from a seeded request/header — the
 * same mechanism session spawn uses. This plugin therefore registers its own
 * provider that delegates to the deployment's real driver
 * (`startInProcessRun`, discovered from the dsh package that owns the shipped
 * presets) with a one-event seed carrying the full route triple. When the
 * driver cannot be located, it degrades to the stock `spawn` provider
 * (persona + provider/model still apply; effort falls back to adapter
 * default) — never to a silent wrong route.
 */
const PERSONA_PROVIDER = 'agents-persona'
/** label → route triple, stashed by the tool just before subagents.start. */
const pendingPersonaRoutes = new Map()
let _driverModule = undefined

async function loadSubagentDriver() {
  if (_driverModule !== undefined) return _driverModule
  const candidates = []
  if (process.env.DSH_SUBAGENT_DRIVER) candidates.push(process.env.DSH_SUBAGENT_DRIVER)
  for (const root of SHIPPED_PRESET_ROOTS) {
    const pkgRoot = root.replace(/\/config\/agent-presets$/, '')
    candidates.push(`${pkgRoot}/node_modules/@deepseek-ai/dsh-subagent-in-process-driver/lib/index.js`)
    candidates.push(`${pkgRoot}/../../node_modules/@deepseek-ai/dsh-subagent-in-process-driver/lib/index.js`)
  }
  for (const spec of [...candidates, '@deepseek-ai/dsh-subagent-in-process-driver']) {
    try {
      const module = await import(spec)
      if (typeof module.startInProcessRun === 'function') {
        _driverModule = module
        return module
      }
    } catch { /* try next candidate */ }
  }
  _driverModule = null
  console.warn('[dsh-rich-context] subagent driver not found — persona effort falls back to adapter default (persona + provider/model still apply)')
  return null
}

/** The persona text handed to the child: identity line + the TOML prompt. */
function personaTextFor(agent) {
  const identity = `You are ${agent.name || agent.id}${agent.description ? `, ${agent.description}` : ''}.`
  return `${identity}\n\n${String(agent.prompt ?? '').trim()}`
}

/** Codex sandbox_mode → child tool restriction. read-only removes write/exec. */
function toolFilterFor(sandbox) {
  if (String(sandbox ?? '').trim() !== 'read-only') return undefined
  return { deny: ['write', 'edit', 'bash', 'pwsh'] }
}

const PERSONA_CAPABILITIES = { outputSchema: true, depthLimit: true, toolFilter: true, persona: true }

class PersonaSpawnProvider {
  constructor(ctx) {
    this.ctx = ctx
  }

  name = PERSONA_PROVIDER

  capabilities = PERSONA_CAPABILITIES

  inheritsParentContext = false

  async start(request) {
    const route = pendingPersonaRoutes.get(request.label)
    pendingPersonaRoutes.delete(request.label)
    const driver = route === undefined ? null : await loadSubagentDriver()
    if (route === undefined || driver === null) {
      // Degraded path: stock spawn semantics (persona + agentOptions apply;
      // effort falls back to the adapter default).
      const fallback = this.ctx.get('subagents')?.getProvider?.('spawn')
      if (fallback === undefined) throw new Error('persona subagent: no spawn provider and no in-process driver available')
      return fallback.start(request)
    }
    const seed = [{
      type: 'request/header',
      seq: 0,
      time: Date.now(),
      data: {
        header: {
          config: {
            provider: route.provider,
            model: route.model,
            ...(route.effort !== undefined && route.effort !== '' && route.effort !== 'default' ? { reasoningEffort: route.effort } : {}),
          },
        },
        reason: 'initial',
      },
    }]
    return driver.startInProcessRun(request, { seed })
  }

  prepareContinuable() {
    return Promise.resolve({})
  }
}

/** Run one persona as a one-shot subagent of the calling agent. */
async function launchPersonaSubagent(ctx, { agent, prompt, requester, signal }) {
  const subagents = typeof ctx?.get === 'function' ? ctx.get('subagents') : undefined
  if (subagents === undefined || requester === undefined) {
    return { ok: false, error: 'subagent delegation requires a calling session (the subagents service and a parent agent)' }
  }
  const label = agent.id
  pendingPersonaRoutes.set(label, { provider: agent.provider, model: agent.model, effort: agent.effort })
  let run
  try {
    run = await subagents.start(PERSONA_PROVIDER, {
      label,
      prompt: [{ type: 'text', text: String(prompt) }],
      parent: requester,
      signal: signal ?? new AbortController().signal,
      agentOptions: { provider: agent.provider, model: agent.model },
      persona: personaTextFor(agent),
      ...(toolFilterFor(agent.sandbox) !== undefined ? { toolFilter: toolFilterFor(agent.sandbox) } : {}),
    })
  } catch (error) {
    pendingPersonaRoutes.delete(label)
    return { ok: false, error: `subagent start failed: ${error instanceof Error ? error.message : String(error)}` }
  }
  let result
  try {
    result = await run.result
  } finally {
    run.dispose?.().catch(() => {})
  }
  const text = (result?.output ?? [])
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n\n')
  return {
    ok: result?.stopReason === 'completed',
    stopReason: result?.stopReason ?? 'error',
    output: text,
    sessionId: run.id,
  }
}

// ── Subagent personas: model-facing `agents` tool ────────────────────────────
function agentsToolDefinition(ctx) {
  return {
    name: 'agents',
    description: 'Named subagent personas with fixed routes (provider + model + effort) and their own system prompts, defined in ~/.dsh/agents/*.toml. agents.launch runs a persona as a one-shot SUBAGENT of this session: the child gets the persona as its system prompt, runs on exactly the route its file pins, and its final output returns to you inline — same contract as the built-in `subagent` tool, but with a named persona and route instead of an anonymous child. Use the built-in `subagent` tool for quick anonymous children; use agents when a role matters (auditor, researcher, implementer). actions: list = roster with routes; read = one full definition including the persona prompt; launch = delegate to a persona subagent (id + prompt required).',
    parameters: {
      type: 'object',
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['list', 'read', 'launch'], description: 'list = roster; read = one definition; launch = delegate to a persona subagent (result returns inline).' },
        id: { type: 'string', description: 'Agent id (see list). Required for read and launch.' },
        prompt: { type: 'string', description: 'launch: the complete task for the persona subagent — role context it lacks, the task, requirements, and the reporting format you want back.' },
      },
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          message: { type: 'string', description: 'Human-readable result or error.' },
          agents: { type: 'array', items: { type: 'object' }, description: 'list: roster entries {id, name, description, provider, model, effort, routeOk}.' },
          agent: { type: 'object', description: 'read: the full persona definition.' },
          sessionId: { type: 'string', description: 'launch: the child session id.' },
          stopReason: { type: 'string', description: 'launch: completed | aborted | error | max-tokens | refusal.' },
          output: { type: 'string', description: 'launch: the persona subagent\'s final answer, inline.' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      const action = String(args.action ?? 'list')
      const catalog = await buildCatalog(ctx)
      if (action === 'list') {
        const agents = listAgents(catalog).map(({ id, name, description, provider, model, effort, routeOk, routeError, broken }) => ({ id, name, description, provider, model, effort, routeOk, ...(routeError !== null && routeError !== undefined ? { routeError } : {}), ...(broken === true ? { broken } : {}) }))
        return { ok: true, agents, message: agents.length === 0 ? 'No personas defined — create them in the Agents panel (sidebar → Agents) or ~/.dsh/agents/*.toml.' : `${agents.length} persona(s).` }
      }
      const id = String(args.id ?? '').trim()
      if (id === '') return { ok: false, message: 'id is required for read/launch.' }
      const agent = listAgents(catalog).find((entry) => entry.id === id)
      if (agent === undefined) return { ok: false, message: `agent "${id}" not found — use action:list for the roster.` }
      if (action === 'read') {
        const { routeOk, routeError, presetSynced, file, ...definition } = agent
        return { ok: true, agent: definition, message: `Persona "${id}" (${agent.provider}/${agent.model}/${agent.effort}${presetSynced ? ', preset synced' : ''}).` }
      }
      if (action === 'launch') {
        const requester = exec?.agent
        if (requester === undefined) return { ok: false, message: 'launch requires a calling session (run from a live agent).' }
        if (agent.routeOk !== true) return { ok: false, message: `route invalid: ${agent.routeError ?? 'fix provider/model/effort in the Agents panel'}` }
        const result = await launchPersonaSubagent(ctx, { agent, prompt: args.prompt, requester, signal: exec?.signal })
        if (!result.ok && result.error !== undefined) return { ok: false, message: result.error }
        return {
          ok: result.ok,
          sessionId: result.sessionId,
          stopReason: result.stopReason,
          output: result.output,
          message: result.ok
            ? `Persona "${id}" subagent completed on ${agent.provider}/${agent.model}/${agent.effort}; its answer is in output.`
            : `Persona "${id}" subagent ended with stopReason ${result.stopReason}; partial output (if any) is in output.`,
        }
      }
      return { ok: false, message: `unknown action "${action}".` }
    },
  }
}

/** Test surface for the pure helpers (no service wiring). */
export const __internals = { parseToml, serializeToml, parseMdAgent, normalizeEffort, buildAgentId, validateRoute, personaRow, compileComposition, readAgentFile, personaTextFor, toolFilterFor }

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
      {
        kind: 'exact',
        path: `${API_PREFIX}/agents`,
        handler: (req, res) => {
          if (req.method !== 'GET') { writeJson(res, 405, { ok: false, error: 'method-not-allowed' }); return }
          if (!guard(req, res)) return
          buildCatalog(ctx).then((catalog) => {
            writeJson(res, 200, { ok: true, dir: AGENTS_DIR, agents: listAgents(catalog) })
          }).catch((error) => writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) }))
        },
      },
      {
        kind: 'exact',
        path: `${API_PREFIX}/agents/file`,
        handler: async (req, res) => {
          if (req.method !== 'GET' && req.method !== 'PUT' && req.method !== 'DELETE') { writeJson(res, 405, { ok: false, error: 'method-not-allowed' }); return }
          if (!guard(req, res)) return
          const url = new URL(req.url ?? '/', 'http://localhost')
          if (req.method === 'GET') {
            const id = String(url.searchParams.get('id') ?? '')
            if (!PRESET_ID_RE.test(id)) { writeJson(res, 400, { ok: false, error: 'invalid-id' }); return }
            const file = join(AGENTS_DIR, `${id}.toml`)
            const agent = readAgentFile(file)
            if (agent === null) { writeJson(res, 404, { ok: false, error: 'not-found' }); return }
            writeJson(res, 200, { ok: true, agent, raw: readFileOrNull(file) })
            return
          }
          if (req.method === 'DELETE') {
            const id = String(url.searchParams.get('id') ?? '')
            if (!PRESET_ID_RE.test(id)) { writeJson(res, 400, { ok: false, error: 'invalid-id' }); return }
            const file = join(AGENTS_DIR, `${id}.toml`)
            const presetResult = removePreset(id)
            try {
              if (existsSync(file)) unlinkSync(file)
              writeJson(res, 200, { ok: true, preset: presetResult })
            } catch (error) {
              writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
            }
            return
          }
          // PUT — validate + write + compile preset.
          if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) { writeJson(res, 415, { ok: false, error: 'json-required' }); return }
          let body
          try { body = await readJsonBody(req, ACTION_LIMIT) } catch (error) {
            writeJson(res, error?.message === 'body-too-large' ? 413 : 400, { ok: false, error: error?.message ?? 'bad-request' })
            return
          }
          if (typeof body !== 'object' || body === null || typeof body.agent !== 'object' || body.agent === null) {
            writeJson(res, 400, { ok: false, error: 'invalid-body' }); return
          }
          const agent = {
            id: String(body.agent.id ?? '').trim(),
            name: String(body.agent.name ?? '').trim(),
            description: String(body.agent.description ?? '').trim(),
            provider: String(body.agent.provider ?? '').trim(),
            model: String(body.agent.model ?? '').trim(),
            effort: normalizeEffort(body.agent.effort),
            sandbox: String(body.agent.sandbox ?? 'read-only').trim(),
            prompt: String(body.agent.prompt ?? '').trim(),
          }
          if (!PRESET_ID_RE.test(agent.id)) { writeJson(res, 400, { ok: false, error: 'invalid-id — must match [a-z0-9][a-z0-9-]*' }); return }
          if (agent.name === '') agent.name = agent.id
          if (agent.prompt === '') { writeJson(res, 400, { ok: false, error: 'prompt-required — developer_instructions cannot be empty' }); return }
          const reserved = reservedIds()
          const prevId = typeof body.prevId === 'string' && body.prevId !== '' ? body.prevId : null
          if (reserved.has(agent.id) && agent.id !== prevId) { writeJson(res, 409, { ok: false, error: `id "${agent.id}" is reserved (shipped or foreign preset)` }); return }
          if (body.strict !== false) {
            const catalog = await buildCatalog(ctx)
            const route = validateRoute(catalog, agent.provider, agent.model, agent.effort)
            if (!route.ok) { writeJson(res, 400, { ok: false, error: `route invalid: ${route.error}` }); return }
          }
          try {
            mkdirSync(AGENTS_DIR, { recursive: true })
            agent.file = join(AGENTS_DIR, `${agent.id}.toml`)
            writeFileSync(agent.file, serializeToml(agent, typeof body.provenance === 'string' ? body.provenance : ''), 'utf8')
            if (prevId !== null && prevId !== agent.id) {
              const prevFile = join(AGENTS_DIR, `${prevId}.toml`)
              if (existsSync(prevFile)) unlinkSync(prevFile)
              removePreset(prevId)
            }
            const presetDir = writePreset(agent)
            writeJson(res, 200, { ok: true, file: agent.file, presetDir })
          } catch (error) {
            writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        },
      },
      {
        kind: 'exact',
        path: `${API_PREFIX}/agents/catalog`,
        handler: (req, res) => {
          if (req.method !== 'GET') { writeJson(res, 405, { ok: false, error: 'method-not-allowed' }); return }
          if (!guard(req, res)) return
          buildCatalog(ctx).then((catalog) => {
            const providers = Object.entries(catalog.providers)
              .map(([id, entry]) => ({ id, label: entry.label, models: Object.entries(entry.models).map(([modelId, model]) => ({ id: modelId, name: model.name, efforts: model.efforts, defaultEffort: model.defaultEffort ?? null })) }))
              .sort((a, b) => a.id.localeCompare(b.id))
            writeJson(res, 200, { ok: true, providers, defaultRoute: catalog.defaultRoute })
          }).catch((error) => writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) }))
        },
      },
      {
        kind: 'exact',
        path: `${API_PREFIX}/agents/import`,
        handler: async (req, res) => {
          if (req.method !== 'GET' && req.method !== 'POST') { writeJson(res, 405, { ok: false, error: 'method-not-allowed' }); return }
          if (!guard(req, res)) return
          const catalog = await buildCatalog(ctx)
          if (req.method === 'GET') {
            writeJson(res, 200, { ok: true, candidates: importCandidates(catalog) })
            return
          }
          if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) { writeJson(res, 415, { ok: false, error: 'json-required' }); return }
          let body
          try { body = await readJsonBody(req, ACTION_LIMIT) } catch (error) {
            writeJson(res, 400, { ok: false, error: error?.message ?? 'bad-request' })
            return
          }
          const wanted = new Set(Array.isArray(body?.paths) ? body.paths.map(String) : [])
          if (wanted.size === 0) { writeJson(res, 400, { ok: false, error: 'paths-required' }); return }
          const candidates = importCandidates(catalog).filter((candidate) => wanted.has(candidate.path))
          const imported = []
          const skipped = []
          const reserved = reservedIds()
          for (const candidate of candidates) {
            if (reserved.has(candidate.id) || (candidate.exists && body.overwrite !== true)) {
              skipped.push({ id: candidate.id, path: candidate.path, reason: candidate.exists ? 'already exists' : 'reserved id' })
              continue
            }
            const agent = { ...candidate, file: join(AGENTS_DIR, `${candidate.id}.toml`) }
            try {
              mkdirSync(AGENTS_DIR, { recursive: true })
              writeFileSync(agent.file, serializeToml(agent, candidate.path), 'utf8')
              writePreset(agent)
              const route = agent.provider === '' || agent.model === ''
                ? { ok: false, error: 'route incomplete — set provider and model' }
                : validateRoute(catalog, agent.provider, agent.model, agent.effort)
              imported.push({ id: agent.id, file: agent.file, routeOk: route.ok, routeError: route.ok ? null : route.error })
            } catch (error) {
              skipped.push({ id: candidate.id, path: candidate.path, reason: error instanceof Error ? error.message : String(error) })
            }
          }
          writeJson(res, 200, { ok: true, imported, skipped })
        },
      },
      {
        kind: 'exact',
        path: `${API_PREFIX}/agents/launch`,
        handler: async (req, res) => {
          if (req.method !== 'POST') { writeJson(res, 405, { ok: false, error: 'method-not-allowed' }); return }
          if (!guard(req, res)) return
          if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) { writeJson(res, 415, { ok: false, error: 'json-required' }); return }
          let body
          try { body = await readJsonBody(req, ACTION_LIMIT) } catch (error) {
            writeJson(res, 400, { ok: false, error: error?.message ?? 'bad-request' })
            return
          }
          const id = String(body?.id ?? '').trim()
          if (!PRESET_ID_RE.test(id)) { writeJson(res, 400, { ok: false, error: 'invalid-id' }); return }
          const agent = readAgentFile(join(AGENTS_DIR, `${id}.toml`))
          if (agent === null) { writeJson(res, 404, { ok: false, error: 'agent-not-found' }); return }
          const result = await launchPersona(ctx, { agent, prompt: body?.prompt, cwd: body?.cwd })
          writeJson(res, result.ok ? 200 : 400, result)
        },
      },
    ]
    const disposers = routes.map((route) => ctx.webServer.register(route))
    const disposeTool = ctx.tools.register(agentsToolDefinition(ctx))
    // Register the persona subagent provider (one-shot children with route seed).
    // Lazy ctx.get: absent service (older snapshots) degrades the tool to an error
    // answer instead of failing the whole plugin at boot.
    let disposeProvider = undefined
    try {
      const subagents = ctx.get?.('subagents')
      if (subagents !== undefined && typeof subagents.registerProvider === 'function') {
        disposeProvider = subagents.registerProvider(new PersonaSpawnProvider(ctx))
      } else {
        console.warn('[dsh-rich-context] subagents service absent — agents.launch will answer with an error instead of delegating')
      }
    } catch (error) {
      console.warn(`[dsh-rich-context] persona provider registration failed: ${error instanceof Error ? error.message : String(error)}`)
    }
    return () => {
      disposeProvider?.()
      disposeTool?.()
      for (const dispose of disposers.reverse()) dispose()
    }
  }, 'rich-context: file + template routes')
}
