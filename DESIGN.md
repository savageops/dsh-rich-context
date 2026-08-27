# dsh-rich-context — design (v1)

**What:** a sidebar entry (under the Skill Center, same DOM-injection family) opening an overlay panel for managing the agent instruction files the harness actually reads.

**The real convention (verified, `dsh-agent-instructions/lib/index.js:16,140`):**
- User-global: `~/.dsh/AGENTS.md` (injected into every session)
- Per-workspace: `<workspace-root>/AGENTS.md` (also `CLAUDE.md`, and `.local` overlays — v1 manages `AGENTS.md` primary)

## UI

- **Sidebar entry**: `data-dsh-rich-context-entry`, familySelectors `[taskboard, ssh, skill-explorer, rich-context]` — renders under the Skill Center row; self-healing MutationObserver (skill-explorer's proven pattern, compact local implementation)
- **Overlay panel** (React island, `createRoot`): card centered on dim scrim
  - **Two tabs** (segmented, bleed grammar): **Global** (`~/.dsh/AGENTS.md`) / **Workspace** (picker of workspace slugs → `<root>/AGENTS.md`)
  - **Editor**: monospace textarea, dirty-state tracking, Ctrl/Cmd+S saves
  - **Templates menu**: built-in section templates (coding standards, review checklist, testing policy, communication/language rules, safety rails, commit discipline) + user templates persisted at `~/.dsh/rich-context/templates/*.md`; inserting appends a titled section
  - Status line: saved / error; file path display

## Host routes (loopback + browser-marker fenced)

- `GET /api/rich-context/state` → `{ workspaces: [slugs], files: { global: {content|null}, per-workspace on demand }, templates: [{id,name,source}] }`
- `PUT /api/rich-context/file` `{ scope: 'global'|'workspace', workspace?, content }` → writes (creates parents)
- `GET/PUT/DELETE /api/rich-context/template` → user template CRUD

## Edits take effect

Workspace instruction changes flow into sessions through the existing fs-touch inbox mechanism; the global file applies to new sessions. The panel says which.

Zero runtime deps; node:fs + node:path only.

# v0.2 — Agents: subagent personas (research-locked 2026-08-26)

**Survey decisions (operator, 6 branched questions):** Codex-style TOML native
format · two tabs (Context + Agents) · strict catalog-validated route triple ·
both launch surfaces (model tool + panel button) · own `agents` tool ·
one-time import + convert.

**Persona model:** one `~/.dsh/agents/<id>.toml` per agent — `name`,
`description`, `provider`, `model`, `effort`, `sandbox_mode`,
`developer_instructions` (system prompt). Ids must satisfy the DSH preset rule
`[a-z0-9][a-z0-9-]*` because each persona **compiles to an agent preset** at
`~/.dsh/.agent-presets/<id>/`: the shipped `standard` composition with its
persona row spliced to this agent's prompt (`@deepseek-ai/dsh-persona` row,
same mechanism the hand-built `narrator` preset uses). The preset directory
carries a `.dsh-agents.json` marker; the plugin only ever manages directories
it created and refuses ids held by shipped or foreign presets.

**Route triple (as DSH expects it):** `{provider, model, reasoningEffort}` is
exactly DSH's `ModelSelection` (`sessions.selectModel` contract). Saves are
validated against the live catalog — `ctx.llm.listConfigurableProviders()` +
settings profiles + `resolveModelInfo` effort lists (same sources as the GUI
model picker and memory-evolve's models tab). Models without reasoning efforts
take the literal effort `default`.

**Launch (the effort path nothing else had):** session creation with a seed
`request/header` (seq 0) carrying `config: {provider, model, reasoningEffort}`,
preset mounted through the `agentPresets` service via the `agents.create`
setup callback (pre-set-mount sessions lose official tools — memory-evolve's
documented failure), workspace attach with retry, then `followup(prompt)`.
This is memory-evolve's verified spawn path extended with the effort field
`de_session` does not expose.

**Model tool `agents`:** actions `list | read | launch`. Positioned against
the built-in `subagent` tool: anonymous inline-result children vs named
persona sessions that run independently.

**Import:** scans `~/.codex/agents` + `/root/.codex/agents` (TOML),
`.claude/agents` and `.gemini/agents` (markdown frontmatter — the 6/11
de-facto standard; Cursor and Goose both read `.claude/agents/` natively).
Copies + converts (all five effort spellings normalized, `ultra`→`max`,
`model[effort=]` and `provider/model` forms split), resolves missing provider
from the catalog, stamps `# imported-from:` provenance, never touches the
source. Agents whose model isn't served (e.g. `gpt-5.6-luna`) import with a
needs-route badge and refuse to launch until edited.

# v0.3 — Correction: personas run as subagents, not sessions

**Operator correction 2026-08-27:** personas are the delegation vocabulary of
the calling agent — `agents.launch` now runs a one-shot SUBAGENT through the
`ctx.subagents` service: per-child `persona` (scoped `deployment:persona`
section, applied by dsh-subagent's `applyChildComposition`), `agentOptions`
{provider, model}, and `toolFilter` (read-only sandbox denies write/edit/bash/
pwsh). The child's final output returns inline to the caller — same contract
as the built-in `subagent` tool, with a named persona and pinned route.

**Effort on the subagent path:** AgentOptions has no reasoningEffort (the
workflow seam rejects it loudly), so this plugin registers its own provider
`agents-persona` that delegates to the deployment's real in-process driver
(`startInProcessRun`, discovered from the dsh package owning the shipped
presets, `$DSH_SUBAGENT_DRIVER` overridable) with a one-event seed
request/header carrying `{provider, model, reasoningEffort}` — the same
restoration channel session spawn uses. Driver unlocatable → degrades to the
stock `spawn` provider (persona + provider/model still apply; effort falls
back to adapter default), never a silent wrong route.

**Panel:** the roster's launch button is now honestly labeled "Run as
session" (standalone sidebar session — still the right tool for manual,
independent runs); the model-facing `agents` tool is the subagent path.

# v0.4 — YAGNI pass (operator correction #2)

"Nothing changes really — subagents get their own context injected (the
agents/ file contents itself). See codex, claude, zcode." Cut everything that
did not serve that sentence:

- **Cut:** preset compilation (agent.cordis.yml generation, markers, reserved
  ids — generated dirs removed), session spawning (seed route, workspace
  attach, the /agents/launch HTTP route), the panel launch button, and
  strict save-time catalog validation. Saves are free-form; roster computes
  route health live; launch refuses invalid routes.
- **Kept:** ~/.dsh/agents/*.toml store, panel editor + importer, catalog-fed
  route pickers, and the `agents` tool — list / read / **launch** = one-shot
  subagent via ctx.subagents with the persona file contents injected as the
  child's system prompt (identity line + developer_instructions) plus the
  route triple (agentOptions + the seeded request/header through the
  deployment's own in-process driver) and read-only tool filtering.
