# dsh-rich-context

**Agent instruction manager for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)** — edit, refine, and route the `AGENTS.md` files your agents actually read, from a sidebar panel under the Skill Center.

> 管理 AGENTS.md——agent 实际读取的指令文件：全局/工作区编辑、自定义路径、跨工具源扫描与默认切换。

## Install

```sh
dsh plugin --profile web add dsh-rich-context
```

Restart the `dsh web` process. A **Context** entry appears in the sidebar (under Skill Center).

## What it manages

The harness reads instruction files from two scopes (verified in `dsh-agent-instructions`):
- **User-global**: `~/.dsh/AGENTS.md` — injected into every session
- **Per-workspace**: `<workspace-root>/AGENTS.md` — scoped to that workspace's sessions

Plus **custom paths** — click the path in the header to route to any absolute file path.

## The panel

Two tabs (segmented, bleed grammar):

- **Global** — edit `~/.dsh/AGENTS.md` with the monospace editor (Ctrl+S saves)
- **Workspace** — pick a workspace from the dropdown, edit its root `AGENTS.md`

The **path field** in the header is click-to-edit: click it, type any absolute path, Enter to load that file instead. The editor follows.

## Source scanning + default switching

On the Global tab, the **AGENTS.md sources** section scans 10 tool directories (`.dsh`, `.codex`, `.claude`, `.omp`, `.pi`, `.cursor`, `.aider`, `.gemini`, `.copilot`, `.continue` — plus home root) for `AGENTS.md` and `CLAUDE.md` files. Each detected file lists with its line count and a **Set as default** button — clicking it **symlinks** `~/.dsh/AGENTS.md` to that file, so the harness transparently reads whichever tool's instructions you designate as the single source of truth. Reset restores a plain file.

## Architecture

```
src/host.js            Node half — /api/rich-context/{state,file,template,sources,default}
                       routes. Scans tool dirs, manages symlinks, reads/writes
                       AGENTS.md files. Node builtins only.
src/client.bundle.js   Browser half — pure DOM overlay (no React dependency):
                       sidebar entry + panel with tabs, editor, source scanner.
```

## License

[MIT](LICENSE)
