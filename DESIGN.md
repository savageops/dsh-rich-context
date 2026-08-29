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
