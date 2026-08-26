# dsh-rich-context

**Agent manager for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)** — edit the `AGENTS.md` files your agents read, and define **subagent personas**: named roles with their own system prompt and a pinned `provider / model / effort` route, launchable as real sessions.

> 管理 AGENTS.md 与子代理人格：全局/工作区编辑、源扫描与默认切换；每个角色一个 Codex 风格 TOML（含 provider/model/effort 路由），编译为 DSH 预设、可从面板或模型的 agents 工具启动为真实会话。

## Install

```sh
dsh plugin --profile web add dsh-rich-context
```

Restart the `dsh web` process. An **Agents** entry appears in the sidebar (under Skill Center).

## Two modes

**Context** — the AGENTS.md manager (unchanged from v0.1):

- **Global** — edit `~/.dsh/AGENTS.md` with the monospace editor (Ctrl+S saves)
- **Workspace** — pick a workspace from the dropdown, edit its root `AGENTS.md`
- **Sources** — scan 10 tool directories, symlink any detected `AGENTS.md`/`CLAUDE.md` as the default

**Agents** — the persona roster:

- One `~/.dsh/agents/<id>.toml` per agent: `name`, `description`, `provider`, `model`, `effort`, `sandbox_mode`, `developer_instructions` (the system prompt)
- Every route is validated against the live model catalog — the same source the GUI model picker uses; glm-5.3 offers `high|max`, models without reasoning take `default`
- Each persona **compiles to a DSH agent preset** (`~/.dsh/.agent-presets/<id>/`, standard composition with the persona row spliced in), so sessions compose from it like any preset
- **Launch** spawns a real standard session: the seed request/header carries the full `{provider, model, reasoningEffort}` triple — the effort field no other spawn surface exposes — with the preset mounted and the workspace attached
- **Import** copies + converts foreign agent files (Codex TOML from `~/.codex/agents` / `/root/.codex/agents`, Claude/Gemini markdown frontmatter), normalizing all five effort spellings; sources are never touched and provenance is stamped

## Model-facing `agents` tool

The plugin registers an `agents` tool: `list` the roster with routes, `read` one definition, `launch` a persona session. Use it for role-specialized delegation (auditor, researcher, implementer); the built-in `subagent` tool remains the right choice for anonymous children whose result you need inline.

## Architecture

```
src/host.js            Node half — /api/rich-context/{state,file,template,sources,default}
                       plus /agents/{list,file,catalog,import,launch}: persona TOML store,
                       preset compiler, live model catalog, session spawner with seed
                       request/header route, and the `agents` tool registration.
src/client.bundle.js   Browser half — pure DOM overlay (no React dependency):
                       sidebar entry + panel with Context/Agents mode tabs.
```

## License

[MIT](LICENSE)
