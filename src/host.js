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
 *  - GET    /api/rich-context/agents         (persona roster, live route health)
 *  - GET    /api/rich-context/agents/file    (one persona TOML, parsed + raw)
 *  - PUT    /api/rich-context/agents/file    (write TOML; health computed live)
 *  - DELETE /api/rich-context/agents/file    (remove TOML)
 *  - GET    /api/rich-context/agents/catalog (providers → models → efforts)
 *  - GET    /api/rich-context/agents/import  (foreign agent files, converted preview)
 *  - POST   /api/rich-context/agents/import  (copy + convert selected foreign files)
 *
 * Persona model (v0.4.1 — "a slight edit to the normal subagents"):
 *  - One Codex-style TOML per agent in <DSH_HOME>/agents/<id>.toml:
 *    name, description, provider, model, effort, sandbox_mode,
 *    developer_instructions (the persona / system prompt).
 *  - agents.launch = the sanctioned one-shot subagent call:
 *    subagents.start('spawn', { label, prompt, parent, signal,
 *    agentOptions {provider, model}, persona <file contents>, toolFilter }).
 *    The persona file's contents become the child's system prompt; the child
 *    is a normal subagent of the caller and its output returns inline.
 *  - The effort field is stored for Codex parity but not applied on the
 *    subagent path (DSH's AgentOptions has no reasoningEffort).
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
/** Agent id rule (also the persona filename slug rule). */
const PRESET_ID_RE = /^[a-z0-9][a-z0-9-]*$/

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
  const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n')
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

/** Decode TOML basic-string escapes in ONE pass — sequential replaces double-unescaped
 *  serialized backslashes (\\n became a real newline, corrupting Windows paths/regexes). */
function decodeTomlString(text) {
  return String(text).replace(/\\(["\\ntr])/g, (_, c) => (c === 'n' ? '\n' : c === 't' ? '\t' : c === 'r' ? '\r' : c))
}

/** Escape a value for a TOML single-line basic string. */
function encodeTomlBasic(value) {
  return `"${String(value ?? '').replace(/[\\]/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ')}"`
}

/** Serialize the persona TOML in canonical field order. */
function serializeToml(agent, provenance) {
  const head = provenance ? `# imported-from: ${String(provenance).replace(/[\r\n]+/g, ' ')}\n` : ''
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
        let effortsUnknown = false
        if (efforts.size === 0 && typeof llm.resolveModelInfo === 'function') {
          try {
            const info = await llm.resolveModelInfo(providerId, id)
            for (const effort of info?.reasoning?.efforts ?? []) efforts.add(String(effort.id))
            if (info?.reasoning?.defaultEffort !== undefined) defaultEffort = String(info.reasoning.defaultEffort)
          } catch {
            // Transient fetch failure is NOT a model property — flag it so
            // validation says "retry" instead of lying "supports no efforts".
            effortsUnknown = true
          }
        }
        models[id] = {
          name: typeof rawModel?.name === 'string' && rawModel.name !== '' ? rawModel.name : id,
          efforts: [...efforts],
          defaultEffort,
          ...(effortsUnknown === true ? { effortsUnknown: true } : {}),
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
    if (modelEntry.effortsUnknown === true && effort !== 'default') return { ok: false, error: `catalog metadata unavailable for ${provider}/${model} — retry in a moment` }
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
    return { ...agent, routeOk: route.ok, routeError: route.ok ? null : route.error, toolRegistered: registeredPersonaTools.has(agent.id) }
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
      const baseId = id
      let uniqueId = id
      for (let n = 2; candidates.some((c) => c.id === uniqueId); n += 1) uniqueId = `${baseId}-${n}`
      candidates.push({
        path,
        real,
        source: source.label,
        format: source.format,
        id: uniqueId,
        exists: existing.has(uniqueId),
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

/** Run one persona as a one-shot subagent of the calling agent (slight edit to normal subagents). */
async function launchPersonaSubagent(ctx, { agent, prompt, requester, signal }) {
  const subagents = typeof ctx?.get === 'function' ? ctx.get('subagents') : undefined
  if (subagents === undefined || requester === undefined) {
    return { ok: false, error: 'subagent delegation requires a calling session (the subagents service and a parent agent)' }
  }
  let run
  try {
    run = await subagents.start('spawn', {
      label: agent.id,
      prompt: [{ type: 'text', text: String(prompt) }],
      parent: requester,
      signal: signal ?? new AbortController().signal,
      agentOptions: { provider: agent.provider, model: agent.model },
      persona: personaTextFor(agent),
      ...(toolFilterFor(agent.sandbox) !== undefined ? { toolFilter: toolFilterFor(agent.sandbox) } : {}),
    })
  } catch (error) {
    return { ok: false, error: `subagent start failed: ${error instanceof Error ? error.message : String(error)}` }
  }
  let result
  try {
    result = await run.result
  } finally {
    run.dispose?.().catch(() => {})
  }
  const blocks = result?.output ?? []
  const text = blocks
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n\n')
  const omitted = blocks.filter((block) => block?.type !== 'text').length
  return {
    ok: result?.stopReason === 'completed',
    stopReason: result?.stopReason ?? 'error',
    output: text,
    ...(omitted > 0 ? { nonTextBlocksOmitted: omitted } : {}),
    sessionId: run.id,
  }
}

// ── Subagent personas: one tool per persona (the slight edit) ────────────────
/**
 * Each persona file becomes its own subagent tool instance — the same idiom
 * the standard preset uses for tool-subagent rows. No umbrella `agents` tool,
 * no roster actions: the model sees `security-reviewer`, `proof-auditor`, …
 * directly in its tool list and calls them like the normal subagent tool.
 * The persona file is re-read at call time, so edits apply without re-register.
 */
function personaToolDefinition(ctx, agent) {
  return {
    name: agent.id,
    description: `${agent.description || `Subagent persona ${agent.id}`} — one-shot subagent pinned to ${agent.provider}/${agent.model}; the persona file is its system prompt and its final answer returns inline. Give the complete task in prompt.`,
    parameters: {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: { type: 'string', description: 'The complete task for this persona: context it lacks, the work, and the reporting format you want back.' },
        description: { type: 'string', description: 'Optional short label for this delegation.' },
      },
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          message: { type: 'string' },
          output: { type: 'string', description: 'The persona subagent\'s final answer, inline.' },
          stopReason: { type: 'string' },
          sessionId: { type: 'string' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      const requester = exec?.agent
      if (requester === undefined) return { ok: false, message: 'this persona runs as a subagent and requires a calling session.' }
      if (typeof args?.prompt !== 'string' || args.prompt.trim() === '') return { ok: false, message: 'prompt is required.' }
      // Re-read the file so edits apply without a process restart.
      const fresh = readAgentFile(join(AGENTS_DIR, `${agent.id}.toml`))
      if (fresh === null) return { ok: false, message: `persona file for "${agent.id}" is missing or unparsable — restore it or remove the tool registration with a restart.` }
      const current = fresh
      const catalog = await buildCatalog(ctx)
      const route = current.provider === '' || current.model === ''
        ? { ok: false, error: 'route incomplete — set provider and model in the Agents panel' }
        : validateRoute(catalog, current.provider, current.model, current.effort)
      if (!route.ok) return { ok: false, message: `persona route invalid: ${route.error}` }
      const result = await launchPersonaSubagent(ctx, { agent: current, prompt: args.prompt, requester, signal: exec?.signal })
      if (!result.ok && result.error !== undefined) return { ok: false, message: result.error }
      return {
        ok: result.ok,
        sessionId: result.sessionId,
        stopReason: result.stopReason,
        output: result.output,
        message: result.ok
          ? `Persona "${current.id}" subagent completed on ${current.provider}/${current.model}; its answer is in output.`
          : `Persona "${current.id}" subagent ended with stopReason ${result.stopReason}; partial output (if any) is in output.`,
      }
    },
  }
}

/** Persona ids whose tools registered this boot (roster visibility, review P1). */
const registeredPersonaTools = new Set()

/** Register one tool per persona file; skips are loud and roster-visible. */
function registerPersonaTools(ctx) {
  const disposers = []
  registeredPersonaTools.clear()
  for (const file of listAgentFiles()) {
    const agent = readAgentFile(file)
    if (agent === null || !PRESET_ID_RE.test(agent.id) || String(agent.prompt ?? '').trim() === '') {
      console.warn(`[dsh-rich-context] persona "${file.split('/').pop()}" skipped at registration (unparsable, invalid id, or empty prompt)`)
      continue
    }
    try {
      disposers.push(ctx.tools.register(personaToolDefinition(ctx, agent)))
      registeredPersonaTools.add(agent.id)
    } catch (error) {
      console.warn(`[dsh-rich-context] persona tool "${agent.id}" not registered: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return disposers
}

/** Test surface for the pure helpers (no service wiring). */
export const name = 'dsh-rich-context'
export const inject = ['tools', 'webServer', 'agents', 'systemPrompt']

export const __internals = { parseToml, serializeToml, parseMdAgent, normalizeEffort, buildAgentId, validateRoute, readAgentFile, personaTextFor, toolFilterFor }

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
            try {
              if (existsSync(file)) unlinkSync(file)
              writeJson(res, 200, { ok: true })
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
          let prevId = typeof body.prevId === 'string' && body.prevId !== '' ? body.prevId : null
          if (prevId !== null && !PRESET_ID_RE.test(prevId)) { writeJson(res, 400, { ok: false, error: 'invalid-prev-id' }); return }
          // YAGNI pass: saves are free-form (Claude-style skip-with-diagnostic);
          // the roster computes route health live and launch refuses invalid routes.
          try {
            mkdirSync(AGENTS_DIR, { recursive: true })
            agent.file = join(AGENTS_DIR, `${agent.id}.toml`)
            writeFileSync(agent.file, serializeToml(agent, typeof body.provenance === 'string' ? body.provenance : ''), 'utf8')
            if (prevId !== null && prevId !== agent.id) {
              const prevFile = join(AGENTS_DIR, `${prevId}.toml`)
              if (existsSync(prevFile)) unlinkSync(prevFile)
            }
            writeJson(res, 200, { ok: true, file: agent.file })
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
          let catalog
          try { catalog = await buildCatalog(ctx) }
          catch (error) {
            console.warn(`[dsh-rich-context] catalog build failed: ${error instanceof Error ? error.message : String(error)}`)
            writeJson(res, 500, { ok: false, error: 'catalog-unavailable' })
            return
          }
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
          for (const candidate of candidates) {
            if (candidate.exists && body.overwrite !== true) {
              skipped.push({ id: candidate.id, path: candidate.path, reason: 'already exists' })
              continue
            }
            const agent = { ...candidate, file: join(AGENTS_DIR, `${candidate.id}.toml`) }
            try {
              mkdirSync(AGENTS_DIR, { recursive: true })
              writeFileSync(agent.file, serializeToml(agent, candidate.path), 'utf8')
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
    ]
    const disposers = routes.map((route) => ctx.webServer.register(route))
    const disposePersonaTools = registerPersonaTools(ctx)
    return () => {
      for (const dispose of disposePersonaTools.reverse()) dispose?.()
      for (const dispose of disposers.reverse()) dispose()
    }
  }, 'rich-context: file + template routes')
}
