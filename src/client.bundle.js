window.__ModuleLoader__.load({
	id: "dsh-rich-context",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		//#region lib/locale.js
		const NS = "rich-context";
		const en = {
			"entry.label": "Agents",
			"entry.tooltip": "Manage AGENTS.md and subagent personas — roles, routes, prompts",
			"panel.title": "Agents",
			"mode.context": "Context",
			"mode.agents": "Agents",
			"mode.context.hint": "AGENTS.md — the instructions every session reads",
			"mode.agents.hint": "Subagent personas — one TOML per role in ~/.dsh/agents",
			"ag.empty": "No personas yet — create one or import from Codex/Claude/Gemini.",
			"ag.new": "New agent",
			"ag.import": "Import…",
			"ag.launch": "Run as session",
			"ag.edit": "Edit",
			"ag.delete": "Delete",
			"ag.save": "Save",
			"ag.cancel": "Cancel",
			"ag.saved": "saved + preset compiled",
			"ag.launchTitle": "Run as session",
			"ag.launchNote": "This button runs the persona as a standalone sidebar session. The model-facing agents tool runs personas as inline subagents of the calling conversation.",
			"ag.launchPrompt": "First message for the new session (role, task, requirements)…",
			"ag.launchCwd": "Working directory",
			"ag.launching": "Starting session…",
			"ag.launched": "launched as",
			"ag.importTitle": "Import agents",
			"ag.importHint": "Foreign files are copied + converted; sources are never touched.",
			"ag.importSelected": "Import selected",
			"ag.importDone": "imported",
			"ag.needsRoute": "needs route",
			"ag.broken": "unparsable",
			"ag.field.id": "Id",
			"ag.field.name": "Name",
			"ag.field.description": "Description",
			"ag.field.provider": "Provider",
			"ag.field.model": "Model",
			"ag.field.effort": "Effort",
			"ag.field.sandbox": "Sandbox",
			"ag.field.prompt": "System prompt (developer_instructions)",
			"ag.sandboxNote": "Stored for round-trip with Codex; DSH presets do not enforce it.",
			"ag.routeIncomplete": "set provider + model + effort before launch",
			"tab.global": "Global",
			"tab.workspace": "Workspace",
			"tab.global.hint": "~/.dsh/AGENTS.md — applies to every session",
			"tab.workspace.hint": "<workspace>/AGENTS.md — applies to that workspace",
			"workspace.placeholder": "Select a workspace…",
			"editor.placeholder": "This file is empty — write your rules here.",
			"editor.empty": "No file yet — saving creates it.",
			"action.save": "Save",
			"action.saved": "saved",
			"action.dirty": "unsaved changes",
			"action.close": "Close",
			"error.generic": "failed",
			"effect.global": "Applies to new sessions immediately.",
			"effect.workspace": "Workspace sessions pick this up through file-activity sync.",
			"effect.custom": "Custom path — the harness reads this if configured.",
			"sources.title": "AGENTS.md sources",
			"sources.hint": "All detected instruction files across tool directories",
			"sources.set_default": "Set as default",
			"sources.current": "current default (symlink)",
			"sources.reset": "Reset to plain file",
			"sources.not_found": "not found",
			"sources.lines": "lines",
		};
		const zh = {
			"entry.label": "智能体",
			"entry.tooltip": "管理 AGENTS.md 与子代理人格——角色、路由、提示词",
			"panel.title": "智能体",
			"mode.context": "上下文",
			"mode.agents": "智能体",
			"mode.context.hint": "AGENTS.md——所有会话读取的指令",
			"mode.agents.hint": "子代理人格——每个角色一个 TOML，存于 ~/.dsh/agents",
			"ag.empty": "还没有人格——新建一个，或从 Codex/Claude/Gemini 导入。",
			"ag.new": "新建智能体",
			"ag.import": "导入…",
			"ag.launch": "运行为会话",
			"ag.edit": "编辑",
			"ag.delete": "删除",
			"ag.save": "保存",
			"ag.cancel": "取消",
			"ag.saved": "已保存并编译预设",
			"ag.launchTitle": "运行为会话",
			"ag.launchNote": "此按钮把人格运行为独立的侧栏会话；模型侧的 agents 工具则把人格作为内联子代理运行。",
			"ag.launchPrompt": "新会话的首条消息（角色、任务、要求）…",
			"ag.launchCwd": "工作目录",
			"ag.launching": "启动会话中…",
			"ag.launched": "已启动为",
			"ag.importTitle": "导入智能体",
			"ag.importHint": "外部文件会被复制并转换，源文件绝不改动。",
			"ag.importSelected": "导入选中",
			"ag.importDone": "已导入",
			"ag.needsRoute": "待定路由",
			"ag.broken": "无法解析",
			"ag.field.id": "标识",
			"ag.field.name": "名称",
			"ag.field.description": "描述",
			"ag.field.provider": "供应商",
			"ag.field.model": "模型",
			"ag.field.effort": "思考强度",
			"ag.field.sandbox": "沙箱",
			"ag.field.prompt": "系统提示词（developer_instructions）",
			"ag.sandboxNote": "与 Codex 往返保留；DSH 预设不强制执行。",
			"ag.routeIncomplete": "启动前需设置 provider + model + effort",
			"tab.global": "全局",
			"tab.workspace": "工作区",
			"tab.global.hint": "~/.dsh/AGENTS.md——作用于所有会话",
			"tab.workspace.hint": "<工作区>/AGENTS.md——只作用于该工作区",
			"workspace.placeholder": "选择工作区…",
			"editor.placeholder": "文件为空——直接写你的规则。",
			"editor.empty": "尚无文件——保存即创建。",
			"action.save": "保存",
			"action.saved": "已保存",
			"action.dirty": "有未保存修改",
			"action.close": "关闭",
			"error.generic": "失败",
			"effect.global": "对新会话立即生效。",
			"effect.workspace": "工作区会话通过文件活动同步感知变更。",
			"effect.custom": "自定义路径——如已配置则 harness 会读取。",
			"sources.title": "AGENTS.md 来源",
			"sources.hint": "工具目录中检测到的所有指令文件",
			"sources.set_default": "设为默认",
			"sources.current": "当前默认（符号链接）",
			"sources.reset": "重置为普通文件",
			"sources.not_found": "未找到",
			"sources.lines": "行",
		};
		const lang = (typeof navigator !== "undefined" && /^(zh)/i.test(navigator.language ?? "")) ? "zh" : "en";
		const dict = { en, zh };
		const t = (key) => dict[lang][key] ?? dict.en[key] ?? key;
		//#endregion
		//#region lib/styles.js
		const css = `.rcx-entry{appearance:none;box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;height:36px;padding:0 10px;font:inherit;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:8px;cursor:pointer;text-align:left}
.rcx-entry:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.rcx-entry[data-active="true"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.rcx-entryIcon{display:inline-flex;justify-content:center;align-items:center;width:24px;height:24px;flex:none;color:var(--dsw-alias-label-tertiary)}
.rcx-entryLabel{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rcx-scrim{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;padding:24px}
.rcx-card{width:100%;max-width:960px;max-height:min(92vh,1200px);border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-specific-tip);border-radius:12px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.3)}
.rcx-card,.rcx-card *{box-sizing:border-box}
.rcx-head{display:flex;align-items:baseline;gap:10px;padding:14px 0 10px}
.rcx-titleRow{display:flex;align-items:center;gap:10px;padding:0 16px;width:100%}
.rcx-title{font-size:14px;font-weight:500;line-height:20px;color:var(--dsw-alias-label-primary);flex:none}
.rcx-path{min-width:0;flex:1;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:16px;font-family:ui-monospace,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;text-decoration:underline dotted}
.rcx-pathInput{min-width:0;flex:1;border:1px solid var(--dsw-alias-state-business-primary);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:12px;line-height:16px;font-family:ui-monospace,monospace;padding:2px 6px;border-radius:6px;outline:none}
.rcx-closeBtn{flex:none;width:28px;height:28px;display:grid;place-items:center;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:999px;font-size:16px}
.rcx-closeBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.rcx-tabs{display:flex;border-top:1px solid var(--dsw-alias-border-l1);border-bottom:1px solid var(--dsw-alias-border-l1)}
.rcx-tab{appearance:none;background:0 0;border:none;border-right:1px solid var(--dsw-alias-border-l1);padding:8px 16px;font:inherit;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);cursor:pointer}
.rcx-tabOn{color:var(--dsw-alias-state-business-primary);font-weight:500}
.rcx-tab:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.rcx-tabHint{flex:1;align-self:center;padding:0 12px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rcx-picker{padding:8px 16px 0}
.rcx-select{width:100%;height:30px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);border-radius:8px;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:0 8px}
.rcx-editorWrap{flex:1;min-height:0;display:flex;flex-direction:column;padding:8px 0 0;overflow:hidden}
.rcx-editor{flex:1;min-height:300px;height:100%;width:100%;resize:none;border:none;outline:none;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:ui-monospace,monospace;font-size:12.5px;line-height:19px;padding:10px 16px;scrollbar-width:none}
.rcx-editor::-webkit-scrollbar{display:none}
.rcx-empty{padding:2px 16px;color:var(--dsw-alias-label-caption);font-size:11px;line-height:14px}
.rcx-sources{border-top:1px solid var(--dsw-alias-border-l1);padding:8px 16px}
.rcx-sourcesHead{display:flex;align-items:baseline;gap:8px;margin-bottom:4px}
.rcx-sourcesTitle{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:14px;text-transform:uppercase;letter-spacing:.05em}
.rcx-sourcesHint{flex:1;color:var(--dsw-alias-label-caption);font-size:11px;line-height:14px}
.rcx-sourceList{display:flex;flex-direction:column;gap:2px;max-height:120px;overflow-y:auto;scrollbar-width:none}
.rcx-sourceList::-webkit-scrollbar{display:none}
.rcx-sourceRow{display:flex;align-items:center;gap:8px;padding:3px 8px;border-radius:6px;cursor:pointer}
.rcx-sourceRow:hover{background:var(--dsw-alias-interactive-bg-hover)}
.rcx-sourceOn{background:color-mix(in srgb, var(--dsw-alias-state-business-primary) 8%, transparent)}
.rcx-sourceLabel{flex:1;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rcx-sourceMeta{color:var(--dsw-alias-label-caption);font-size:11px;line-height:14px;flex:none}
.rcx-sourceBtn{flex:none;background:0 0;border:1px solid var(--dsw-alias-border-l2);border-radius:4px;padding:1px 8px;font:inherit;font-size:11px;line-height:14px;color:var(--dsw-alias-label-secondary);cursor:pointer}
.rcx-sourceBtn:hover{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary)}
.rcx-footer{display:flex;align-items:stretch;border-top:1px solid var(--dsw-alias-border-l1)}
.rcx-status{flex:1;align-self:center;min-width:0;padding:0 12px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rcx-statusErr{color:var(--dsw-alias-state-error-primary)}
.rcx-statusOk{color:var(--dsw-alias-state-success-primary)}
.rcx-saveBtn{appearance:none;background:0 0;border:none;border-left:1px solid var(--dsw-alias-border-l1);padding:9px 20px;font:inherit;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);cursor:pointer}
.rcx-saveBtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.rcx-saveBtn:disabled{opacity:.45;cursor:default}
.rcx-saveDirty{color:var(--dsh-alias-state-business-primary);font-weight:500}
.rcx-modeTabs{display:flex;border-bottom:1px solid var(--dsw-alias-border-l1)}
.rcx-modeTab{appearance:none;background:0 0;border:none;border-right:1px solid var(--dsw-alias-border-l1);padding:10px 16px;font:inherit;font-size:13px;line-height:18px;color:var(--dsw-alias-label-secondary);cursor:pointer}
.rcx-modeTab:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.rcx-modeTabOn{color:var(--dsw-alias-state-business-primary);font-weight:500;box-shadow:inset 0 -2px 0 var(--dsw-alias-state-business-primary)}
.rcx-modeHint{flex:1;align-self:center;padding:0 12px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rcx-body{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.rcx-agList{flex:1;min-height:0;overflow-y:auto;scrollbar-width:none}
.rcx-agList::-webkit-scrollbar{display:none}
.rcx-agRow{display:flex;align-items:center;gap:10px;width:100%;padding:9px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);min-height:52px}
.rcx-agRow:hover{background:var(--dsw-alias-interactive-bg-hover)}
.rcx-agMain{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.rcx-agName{color:var(--dsw-alias-label-primary);font-size:13px;line-height:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rcx-agDesc{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rcx-agChips{display:flex;flex:none;gap:4px;max-width:45%;overflow:hidden}
.rcx-agChip{color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:14px;font-family:ui-monospace,monospace;border:1px solid var(--dsw-alias-border-l2);border-radius:4px;padding:0 5px;white-space:nowrap}
.rcx-agBadge{flex:none;color:var(--dsw-alias-state-warning-primary,#e6a23c);font-size:10.5px;line-height:14px;border:1px solid currentColor;border-radius:4px;padding:0 5px}
.rcx-agActions{display:flex;flex:none;gap:2px}
.rcx-agBtn{appearance:none;background:0 0;border:none;border-radius:6px;padding:4px 8px;font:inherit;font-size:12px;line-height:16px;color:var(--dsw-alias-label-secondary);cursor:pointer}
.rcx-agBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.rcx-agBtnDanger:hover{color:var(--dsw-alias-state-error-primary)}
.rcx-agNew{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);background:0 0;border-top:none;border-left:none;border-right:none;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:13px;cursor:pointer}
.rcx-agNew:hover{color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-interactive-bg-hover)}
.rcx-agNewPlus{font-size:15px;line-height:18px}
.rcx-agForm{flex:1;min-height:0;display:flex;flex-direction:column;overflow-y:auto;scrollbar-width:none;padding:10px 16px;gap:8px}
.rcx-agForm::-webkit-scrollbar{display:none}
.rcx-agField{display:flex;flex-direction:column;gap:3px}
.rcx-agLabel{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:14px}
.rcx-agRow2{display:flex;gap:8px}
.rcx-agRow2>.rcx-agField{flex:1}
.rcx-agInput,.rcx-agArea{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);border-radius:8px;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:5px 8px;outline:none}
.rcx-agInput:focus,.rcx-agArea:focus{border-color:var(--dsw-alias-state-business-primary)}
.rcx-agPrompt{min-height:160px;flex:1;resize:vertical;font-family:ui-monospace,monospace;font-size:12.5px;line-height:19px}
.rcx-agNote{color:var(--dsw-alias-label-caption);font-size:11px;line-height:14px}
.rcx-agFoot{display:flex;align-items:stretch;border-top:1px solid var(--dsw-alias-border-l1)}
.rcx-agCheckRow{display:flex;align-items:flex-start;gap:8px;padding:8px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);cursor:pointer}
.rcx-agCheckRow:hover{background:var(--dsw-alias-interactive-bg-hover)}
.rcx-agCheck{margin-top:2px}`;
		const tagId = "dsh-rich-context/panel.css";
		if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css="${tagId}"]`) === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-rich-context";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region lib/api.js
		const API = "/api/rich-context";
		async function fetchState() {
			const res = await fetch(`${API}/state`, { cache: "no-store" });
			return res.json();
		}
		async function fetchFile(scope, workspace, customPath) {
			const params = new URLSearchParams({ scope });
			if (scope === "workspace") params.set("workspace", workspace ?? "");
			if (scope === "custom") params.set("path", customPath ?? "");
			const res = await fetch(`${API}/file?${params}`, { cache: "no-store" });
			return res.json();
		}
		async function saveFile(body) {
			const res = await fetch(`${API}/file`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
			return res.json();
		}
		async function fetchAgents() {
			const res = await fetch(`${API}/agents`, { cache: "no-store" });
			return res.json();
		}
		async function fetchCatalog() {
			const res = await fetch(`${API}/agents/catalog`, { cache: "no-store" });
			return res.json();
		}
		async function saveAgent(body) {
			const res = await fetch(`${API}/agents/file`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
			return res.json();
		}
		async function deleteAgent(id) {
			const res = await fetch(`${API}/agents/file?id=${encodeURIComponent(id)}`, { method: "DELETE" });
			return res.json();
		}
		async function fetchImportCandidates() {
			const res = await fetch(`${API}/agents/import`, { cache: "no-store" });
			return res.json();
		}
		async function runImport(paths) {
			const res = await fetch(`${API}/agents/import`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paths }) });
			return res.json();
		}
		async function launchAgent(id, prompt, cwd) {
			const res = await fetch(`${API}/agents/launch`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, prompt, cwd }) });
			return res.json();
		}
		//#endregion
		//#region lib/sidebar.js
		const ENTRY_ATTR = "data-dsh-rich-context-entry";
		const FAMILY = ["[data-dsh-taskboard-entry]", "[data-dsh-ssh-entry]", "[data-dsh-skill-explorer-entry]", "[data-dsh-generative-ideas-entry]", `[${ENTRY_ATTR}]`];
		const ICON = `<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5.5" cy="5" r="2.3"/><path d="M1.8 13.2c.6-2.4 2-3.7 3.7-3.7s3.1 1.3 3.7 3.7"/><circle cx="11.2" cy="5.6" r="1.9"/><path d="M10.6 9.6c1.9.1 3.1 1.3 3.6 3.2"/></svg>`;

		function sidebarRoot() {
			const column = document.querySelector('[data-pane="sidebar"], [class*="sidebarCol"]');
			if (column === null) return undefined;
			return column.querySelector('[class*="logoRow"]')?.parentElement ?? column.firstElementChild ?? undefined;
		}
		function newSessionButton(root) {
			const nested = root.querySelector('button[class*="newSession"]');
			if (nested !== null) return nested;
			for (const child of root.children) if (child.tagName === "BUTTON") return child;
			return undefined;
		}
		function mountSidebarEntry(onToggle, isActive, subscribe) {
			if (document.querySelector(`[${ENTRY_ATTR}]`) !== null) return () => {};
			const entry = document.createElement("button");
			entry.type = "button";
			entry.setAttribute(ENTRY_ATTR, "");
			entry.setAttribute("data-dsh-plugin", "rich-context");
			entry.setAttribute("data-dsh-part", "sidebar-entry");
			entry.className = "rcx-entry";
			entry.setAttribute("aria-label", t("entry.tooltip"));
			entry.setAttribute("title", t("entry.tooltip"));
			entry.innerHTML = `<span class="rcx-entryIcon">${ICON}</span><span class="rcx-entryLabel">${t("entry.label")}</span>`;
			entry.addEventListener("click", onToggle);
			let root;
			let placed = false;
			const place = () => {
				const button = root === undefined ? undefined : newSessionButton(root);
				if (button === undefined) return false;
				if (entry.parentElement !== root) {
					const row = button.closest('[class*="logoRow"]');
					const base = row !== null && row.parentElement === root ? row : button;
					const family = Array.from(root.children).filter((el) => el instanceof HTMLElement && el.matches(FAMILY.join(", ")));
					const anchor = family.length > 0 ? family[family.length - 1].nextElementSibling : base.nextElementSibling;
					root.insertBefore(entry, anchor);
				}
				return true;
			};
			const tryPlace = () => {
				if (root !== undefined && !root.isConnected) { rootObserver.disconnect(); root = undefined; placed = false; }
				if (placed && document.body.contains(entry)) return;
				if (placed && !document.body.contains(entry)) { rootObserver.disconnect(); root = undefined; placed = false; }
				root ??= sidebarRoot();
				if (root === undefined) return;
				placed = place();
				if (placed) rootObserver.observe(root, { childList: true, subtree: true });
			};
			const waitObserver = new MutationObserver(tryPlace);
			waitObserver.observe(document.body, { childList: true, subtree: true });
			const rootObserver = new MutationObserver(() => {
				if (root === undefined || !root.isConnected) { placed = false; tryPlace(); return; }
				if (!root.contains(entry)) placed = place();
			});
			let unsubscribe;
			if (subscribe !== undefined) {
				const sync = () => { if (isActive()) entry.setAttribute("data-active", "true"); else entry.removeAttribute("data-active"); };
				unsubscribe = subscribe(sync);
				sync();
			}
			tryPlace();
			return () => {
				waitObserver.disconnect();
				rootObserver.disconnect();
				if (unsubscribe !== undefined) unsubscribe();
				entry.remove();
			};
		}
		//#endregion
		//#region lib/agents-view.js
		/**
		 * The "Agents" mode of the panel — persona roster, editor, launch
		 * dialog, importer. Pure DOM; talks to /api/rich-context/agents/*.
		 */
		function createAgentsView() {
			let view = "roster";
			let agents = [];
			let catalog = null;
			let editing = null; // { prevId, agent }
			let launching = null; // agent being launched
			let candidates = [];
			const checked = new Set();

			const root = document.createElement("div");
			root.className = "rcx-body";
			root.style.display = "none";

			// ── Roster ────────────────────────────────────────────────────────
			const rosterView = document.createElement("div");
			rosterView.className = "rcx-body";
			const listEl = document.createElement("div");
			listEl.className = "rcx-agList";
			const newBtn = document.createElement("button");
			newBtn.type = "button";
			newBtn.className = "rcx-agNew";
			newBtn.innerHTML = `<span class="rcx-agNewPlus">+</span><span>${t("ag.new")}</span>`;
			newBtn.addEventListener("click", () => { editing = { prevId: null, agent: { id: "", name: "", description: "", provider: "", model: "", effort: "default", sandbox: "read-only", prompt: "" } }; setView("edit"); });
			const importBtn = document.createElement("button");
			importBtn.type = "button";
			importBtn.className = "rcx-agNew";
			importBtn.style.borderBottom = "none";
			importBtn.innerHTML = `<span class="rcx-agNewPlus">↧</span><span>${t("ag.import")}</span>`;
			importBtn.addEventListener("click", () => { loadCandidates(); setView("import"); });
			const rosterFoot = document.createElement("div");
			rosterFoot.className = "rcx-agFoot";
			const rosterStatus = document.createElement("span");
			rosterStatus.className = "rcx-status";
			rosterFoot.append(rosterStatus);
			rosterView.append(listEl, newBtn, importBtn, rosterFoot);

			const chipsFor = (agent) => {
				const chips = [];
				const route = [agent.provider || "?", agent.model || "?", agent.effort || "default"];
				const chip = document.createElement("span");
				chip.className = "rcx-agChip";
				chip.textContent = route.join("/");
				chips.push(chip);
				if (agent.sandbox !== undefined && agent.sandbox !== "" && agent.sandbox !== "read-only") {
					const box = document.createElement("span");
					box.className = "rcx-agChip";
					box.textContent = agent.sandbox;
					chips.push(box);
				}
				return chips;
			};

			const renderRoster = () => {
				listEl.innerHTML = "";
				if (agents.length === 0) {
					const empty = document.createElement("div");
					empty.className = "rcx-agNote";
					empty.style.padding = "14px 16px";
					empty.textContent = t("ag.empty");
					listEl.append(empty);
				}
				for (const agent of agents) {
					const row = document.createElement("div");
					row.className = "rcx-agRow";
					const main = document.createElement("div");
					main.className = "rcx-agMain";
					const name = document.createElement("span");
					name.className = "rcx-agName";
					name.textContent = agent.broken === true ? `${agent.id} (${t("ag.broken")})` : `${agent.name} · ${agent.id}`;
					const desc = document.createElement("span");
					desc.className = "rcx-agDesc";
					desc.textContent = agent.broken === true ? (agent.file ?? "") : (agent.description || agent.routeError || "");
					main.append(name, desc);
					const chips = document.createElement("div");
					chips.className = "rcx-agChips";
					if (agent.broken !== true) for (const chip of chipsFor(agent)) chips.append(chip);
					if (agent.broken !== true && agent.routeOk !== true) {
						const badge = document.createElement("span");
						badge.className = "rcx-agBadge";
						badge.textContent = t("ag.needsRoute");
						badge.title = agent.routeError ?? "";
						chips.append(badge);
					}
					const actions = document.createElement("div");
					actions.className = "rcx-agActions";
					const mkBtn = (label, cls, fn) => {
						const btn = document.createElement("button");
						btn.type = "button";
						btn.className = cls;
						btn.textContent = label;
						btn.addEventListener("click", (event) => { event.stopPropagation(); fn(); });
						return btn;
					};
					actions.append(
						mkBtn(t("ag.launch"), "rcx-agBtn", () => { if (agent.broken !== true) { launching = agent; launchPromptEl.value = ""; setView("launch"); } }),
						mkBtn(t("ag.edit"), "rcx-agBtn", () => { if (agent.broken !== true) { editing = { prevId: agent.id, agent: { ...agent } }; setView("edit"); } }),
						mkBtn(t("ag.delete"), "rcx-agBtn rcx-agBtnDanger", () => {
							if (window.confirm(`Delete agent "${agent.id}"?`)) deleteAgent(agent.id).then(() => refresh());
						}),
					);
					row.append(main, chips, actions);
					listEl.append(row);
				}
				rosterStatus.textContent = agents.length === 0 ? "" : `${agents.length}`;
				rosterStatus.title = agents.length === 0 ? "" : `${agents.length} agent(s) in ~/.dsh/agents`;
			};

			// ── Editor ───────────────────────────────────────────────────────
			const editView = document.createElement("div");
			editView.className = "rcx-body";
			const formEl = document.createElement("div");
			formEl.className = "rcx-agForm";
			const field = (labelText, inputEl) => {
				const wrap = document.createElement("div");
				wrap.className = "rcx-agField";
				const label = document.createElement("span");
				label.className = "rcx-agLabel";
				label.textContent = labelText;
				wrap.append(label, inputEl);
				return wrap;
			};
			const idInput = document.createElement("input");
			idInput.className = "rcx-agInput";
			idInput.spellcheck = false;
			idInput.placeholder = "auditor";
			const nameInput = document.createElement("input");
			nameInput.className = "rcx-agInput";
			nameInput.placeholder = "Proof Auditor";
			const descInput = document.createElement("input");
			descInput.className = "rcx-agInput";
			descInput.placeholder = "Read-only auditor for completion evidence…";
			const providerSelect = document.createElement("select");
			providerSelect.className = "rcx-agInput";
			const modelSelect = document.createElement("select");
			modelSelect.className = "rcx-agInput";
			const effortSelect = document.createElement("select");
			effortSelect.className = "rcx-agInput";
			const sandboxSelect = document.createElement("select");
			sandboxSelect.className = "rcx-agInput";
			for (const value of ["read-only", "workspace-write", "danger-full-access"]) {
				const option = document.createElement("option");
				option.value = value;
				option.textContent = value;
				sandboxSelect.append(option);
			}
			const promptArea = document.createElement("textarea");
			promptArea.className = "rcx-agInput rcx-agPrompt";
			promptArea.spellcheck = false;
			promptArea.placeholder = t("ag.field.prompt");
			const idName = field(t("ag.field.id"), idInput);
			const nameField = field(t("ag.field.name"), nameInput);
			const row2 = document.createElement("div");
			row2.className = "rcx-agRow2";
			row2.append(idName, nameField);
			const sandboxField = field(t("ag.field.sandbox"), sandboxSelect);
			const sandboxNote = document.createElement("span");
			sandboxNote.className = "rcx-agNote";
			sandboxNote.textContent = t("ag.sandboxNote");
			const routeRow = document.createElement("div");
			routeRow.className = "rcx-agRow2";
			routeRow.append(field(t("ag.field.provider"), providerSelect), field(t("ag.field.model"), modelSelect), field(t("ag.field.effort"), effortSelect));
			formEl.append(row2, field(t("ag.field.description"), descInput), routeRow, sandboxField, sandboxNote, field(t("ag.field.prompt"), promptArea));
			const editFoot = document.createElement("div");
			editFoot.className = "rcx-agFoot";
			const editStatus = document.createElement("span");
			editStatus.className = "rcx-status";
			const editCancel = document.createElement("button");
			editCancel.type = "button";
			editCancel.className = "rcx-saveBtn";
			editCancel.textContent = t("ag.cancel");
			editCancel.addEventListener("click", () => setView("roster"));
			const editSave = document.createElement("button");
			editSave.type = "button";
			editSave.className = "rcx-saveBtn";
			editSave.textContent = t("ag.save");
			editSave.addEventListener("click", () => {
				const agent = {
					id: idInput.value.trim(),
					name: nameInput.value.trim(),
					description: descInput.value.trim(),
					provider: providerSelect.value,
					model: modelSelect.value,
					effort: effortSelect.value,
					sandbox: sandboxSelect.value,
					prompt: promptArea.value,
				};
				saveAgent({ agent, prevId: editing?.prevId ?? undefined }).then((result) => {
					if (result.ok !== true) throw new Error(result.error);
					editStatus.className = "rcx-status rcx-statusOk";
					editStatus.textContent = `${t("ag.saved")} — ${result.file}`;
					refresh();
					setView("roster");
				}).catch((cause) => {
					editStatus.className = "rcx-status rcx-statusErr";
					editStatus.textContent = `${t("error.generic")}: ${cause.message}`;
				});
			});
			editFoot.append(editStatus, editCancel, editSave);
			editView.append(formEl, editFoot);

			const fillRouteSelects = (agent) => {
				providerSelect.innerHTML = "";
				modelSelect.innerHTML = "";
				effortSelect.innerHTML = "";
				const providers = catalog?.providers ?? [];
				const providerOption = (value, label) => {
					const option = document.createElement("option");
					option.value = value;
					option.textContent = label;
					return option;
				};
				providerSelect.append(providerOption("", "—"));
				for (const provider of providers) providerSelect.append(providerOption(provider.id, provider.label ?? provider.id));
				providerSelect.value = agent.provider && providers.some((p) => p.id === agent.provider) ? agent.provider : "";
				const fillModels = () => {
					modelSelect.innerHTML = "";
					const entry = providers.find((p) => p.id === providerSelect.value);
					modelSelect.append(providerOption("", "—"));
					for (const model of entry?.models ?? []) modelSelect.append(providerOption(model.id, model.name ?? model.id));
					modelSelect.value = agent.model && (entry?.models ?? []).some((m) => m.id === agent.model) ? agent.model : "";
					fillEfforts();
				};
				const fillEfforts = () => {
					effortSelect.innerHTML = "";
					const entry = providers.find((p) => p.id === providerSelect.value);
					const model = (entry?.models ?? []).find((m) => m.id === modelSelect.value);
					const efforts = model?.efforts ?? [];
					if (efforts.length === 0) {
						const option = providerOption("default", "default");
						effortSelect.append(option);
					} else {
						for (const effort of efforts) effortSelect.append(providerOption(effort, effort));
						if (model?.defaultEffort !== undefined && model.defaultEffort !== null && efforts.includes(model.defaultEffort)) {
							effortSelect.value = model.defaultEffort;
						}
					}
					if (efforts.includes(agent.effort)) effortSelect.value = agent.effort;
				};
				providerSelect.onchange = () => { agent = { ...agent, provider: providerSelect.value, model: "", effort: "default" }; fillModels(); };
				modelSelect.onchange = () => { agent = { ...agent, model: modelSelect.value, effort: "default" }; fillEfforts(); };
				fillModels();
			};

			// ── Launch ───────────────────────────────────────────────────────
			const launchView = document.createElement("div");
			launchView.className = "rcx-body";
			const launchForm = document.createElement("div");
			launchForm.className = "rcx-agForm";
			const launchHead = document.createElement("div");
			launchHead.className = "rcx-agField";
			const launchHeadLabel = document.createElement("span");
			launchHeadLabel.className = "rcx-agLabel";
			launchHeadLabel.textContent = t("ag.launchTitle");
			const launchHeadChips = document.createElement("div");
			launchHeadChips.className = "rcx-agChips";
			launchHead.append(launchHeadLabel, launchHeadChips);
			const launchPromptEl = document.createElement("textarea");
			launchPromptEl.className = "rcx-agInput rcx-agPrompt";
			launchPromptEl.spellcheck = false;
			launchPromptEl.placeholder = t("ag.launchPrompt");
			const launchCwd = document.createElement("input");
			launchCwd.className = "rcx-agInput";
			launchCwd.spellcheck = false;
			launchCwd.value = "/home/sysadmin";
			const launchNote = document.createElement("span");
			launchNote.className = "rcx-agNote";
			launchNote.textContent = t("ag.launchNote");
			launchForm.append(launchHead, field(t("ag.launchCwd"), launchCwd), field(t("ag.field.prompt"), launchPromptEl), launchNote);
			const launchFoot = document.createElement("div");
			launchFoot.className = "rcx-agFoot";
			const launchStatus = document.createElement("span");
			launchStatus.className = "rcx-status";
			const launchCancel = document.createElement("button");
			launchCancel.type = "button";
			launchCancel.className = "rcx-saveBtn";
			launchCancel.textContent = t("ag.cancel");
			launchCancel.addEventListener("click", () => setView("roster"));
			const launchGo = document.createElement("button");
			launchGo.type = "button";
			launchGo.className = "rcx-saveBtn rcx-saveDirty";
			launchGo.textContent = t("ag.launch");
			launchGo.addEventListener("click", () => {
				launchStatus.className = "rcx-status";
				launchStatus.textContent = t("ag.launching");
				launchGo.disabled = true;
				launchAgent(launching?.id, launchPromptEl.value, launchCwd.value.trim()).then((result) => {
					if (result.ok !== true) throw new Error(result.error);
					launchStatus.className = "rcx-status rcx-statusOk";
					launchStatus.textContent = `${t("ag.launched")} ${result.sessionId}`;
					window.setTimeout(() => setView("roster"), 1400);
				}).catch((cause) => {
					launchStatus.className = "rcx-status rcx-statusErr";
					launchStatus.textContent = `${t("error.generic")}: ${cause.message}`;
				}).finally(() => { launchGo.disabled = false; });
			});
			launchFoot.append(launchStatus, launchCancel, launchGo);
			launchView.append(launchForm, launchFoot);

			// ── Import ───────────────────────────────────────────────────────
			const importView = document.createElement("div");
			importView.className = "rcx-body";
			const importList = document.createElement("div");
			importList.className = "rcx-agList";
			const importHint = document.createElement("div");
			importHint.className = "rcx-agNote";
			importHint.style.padding = "10px 16px";
			importHint.textContent = t("ag.importHint");
			const importFoot = document.createElement("div");
			importFoot.className = "rcx-agFoot";
			const importStatus = document.createElement("span");
			importStatus.className = "rcx-status";
			const importCancel = document.createElement("button");
			importCancel.type = "button";
			importCancel.className = "rcx-saveBtn";
			importCancel.textContent = t("ag.cancel");
			importCancel.addEventListener("click", () => setView("roster"));
			const importGo = document.createElement("button");
			importGo.type = "button";
			importGo.className = "rcx-saveBtn";
			importGo.textContent = t("ag.importSelected");
			importGo.addEventListener("click", () => {
				const paths = [...checked];
				if (paths.length === 0) return;
				runImport(paths).then((result) => {
					if (result.ok !== true) throw new Error(result.error);
					const imported = result.imported ?? [];
					const skipped = result.skipped ?? [];
					importStatus.className = imported.length > 0 ? "rcx-status rcx-statusOk" : "rcx-status rcx-statusErr";
					importStatus.textContent = `${imported.length} ${t("ag.importDone")}${skipped.length > 0 ? ` · ${skipped.length} skipped` : ""}${imported.some((x) => x.routeOk === false) ? ` · ${t("ag.needsRoute")}` : ""}`;
					refresh();
				}).catch((cause) => {
					importStatus.className = "rcx-status rcx-statusErr";
					importStatus.textContent = `${t("error.generic")}: ${cause.message}`;
				});
			});
			importFoot.append(importStatus, importCancel, importGo);
			importView.append(importList, importHint, importFoot);

			const renderCandidates = () => {
				importList.innerHTML = "";
				checked.clear();
				if (candidates.length === 0) {
					const empty = document.createElement("div");
					empty.className = "rcx-agNote";
					empty.style.padding = "14px 16px";
					empty.textContent = "—";
					importList.append(empty);
					return;
				}
				for (const candidate of candidates) {
					const row = document.createElement("label");
					row.className = "rcx-agCheckRow";
					const box = document.createElement("input");
					box.type = "checkbox";
					box.checked = false;
					box.addEventListener("change", () => { if (box.checked) checked.add(candidate.path); else checked.delete(candidate.path); });
					const main = document.createElement("div");
					main.className = "rcx-agMain";
					const name = document.createElement("span");
					name.className = "rcx-agName";
					name.textContent = `${candidate.name} → ${candidate.id}${candidate.exists ? " (exists)" : ""}`;
					const desc = document.createElement("span");
					desc.className = "rcx-agDesc";
					desc.textContent = `${candidate.source} · ${candidate.model || "?"}${candidate.effort !== "" ? ` · ${candidate.effort}` : ""} · ${candidate.description}`;
					main.append(name, desc);
					const chips = document.createElement("div");
					chips.className = "rcx-agChips";
					if (candidate.provider === "" || candidate.model === "") {
						const badge = document.createElement("span");
						badge.className = "rcx-agBadge";
						badge.textContent = t("ag.needsRoute");
						chips.append(badge);
					} else {
						const chip = document.createElement("span");
						chip.className = "rcx-agChip";
						chip.textContent = `${candidate.provider}/${candidate.model}/${candidate.effort}`;
						chips.append(chip);
					}
					row.append(box, main, chips);
					importList.append(row);
				}
			};

			const loadCandidates = () => {
				fetchImportCandidates().then((body) => {
					if (body.ok !== true) throw new Error(body.error);
					candidates = body.candidates ?? [];
					renderCandidates();
				}).catch(() => { candidates = []; renderCandidates(); });
			};

			// ── Wiring ───────────────────────────────────────────────────────
			root.append(rosterView, editView, launchView, importView);
			const setView = (next) => {
				view = next;
				rosterView.style.display = next === "roster" ? "" : "none";
				editView.style.display = next === "edit" ? "" : "none";
				launchView.style.display = next === "launch" ? "" : "none";
				importView.style.display = next === "import" ? "" : "none";
				if (next === "edit" && editing !== null) {
					idInput.value = editing.agent.id ?? "";
					idInput.disabled = false;
					nameInput.value = editing.agent.name ?? "";
					descInput.value = editing.agent.description ?? "";
					sandboxSelect.value = editing.agent.sandbox ?? "read-only";
					promptArea.value = editing.agent.prompt ?? "";
					fillRouteSelects({ ...editing.agent });
					editStatus.className = "rcx-status";
					editStatus.textContent = "";
				}
				if (next === "launch" && launching !== null) {
					launchHeadChips.innerHTML = "";
					for (const chip of chipsFor(launching)) launchHeadChips.append(chip);
					launchGo.disabled = launching.routeOk !== true;
					launchStatus.className = "rcx-status";
					launchStatus.textContent = launching.routeOk === true ? "" : (launching.routeError ?? t("ag.routeIncomplete"));
					launchCwd.value = "/home/sysadmin";
				}
			};

			const refresh = () => {
				Promise.all([fetchAgents(), fetchCatalog().catch(() => ({ ok: false, providers: [], defaultRoute: null }))]).then(([agentsBody, catalogBody]) => {
					if (agentsBody.ok === true) agents = agentsBody.agents ?? [];
					if (catalogBody.ok === true) catalog = catalogBody;
					renderRoster();
				}).catch(() => {});
			};
			refresh();

			return { root, refresh, setView };
		}
		//#endregion
		//#region lib/panel.js
		/**
		 * The overlay panel — pure DOM, no React. Two tabs (Global / Workspace)
		 * + custom path routing, monospace editor, save.
		 */
		function createPanel(onClose) {
			// --- State ---
			let tab = "global";
			let workspace = "";
			let customPath = null;
			let content = "";
			let saved = null;
			let busy = false;
			let state = null;
			let statusEl, pathEl, editorEl, saveBtnEl, tabHintEl, pickerEl, selectEl;

			// --- Helpers ---
			const setStatus = (kind, text) => {
				statusEl.textContent = text ?? "";
				statusEl.className = kind === "error" ? "rcx-status rcx-statusErr" : kind === "ok" ? "rcx-status rcx-statusOk" : "rcx-status";
			};
			const updateDirty = () => {
				const dirty = content !== (saved ?? "");
				saveBtnEl.disabled = busy || !dirty || (tab === "workspace" && workspace === "" && customPath === null);
				saveBtnEl.className = dirty ? "rcx-saveBtn rcx-saveDirty" : "rcx-saveBtn";
				if (!dirty && statusEl.className.indexOf("Err") === -1) statusEl.textContent = "";
				else if (dirty && statusEl.textContent === "") statusEl.textContent = t("action.dirty");
			};
			const updatePath = () => {
				const p = customPath !== null ? customPath : tab === "global" ? (state?.globalPath ?? "~/.dsh/AGENTS.md") : workspace !== "" ? `${workspace}/AGENTS.md` : "";
				pathEl.textContent = p;
			};
			const loadFile = () => {
				const scope = customPath !== null ? "custom" : tab;
				fetchFile(scope, workspace, customPath).then((body) => {
					if (body.ok !== true) throw new Error(body.error);
					content = body.content ?? "";
					saved = content;
					editorEl.value = content;
					updateDirty();
					updatePath();
				}).catch((cause) => setStatus("error", `${t("error.generic")}: ${cause.message}`));
			};

			// --- Build DOM ---
			const scrim = document.createElement("div");
			scrim.className = "rcx-scrim";
			scrim.addEventListener("click", (event) => { if (event.target === scrim) onClose(); });

			const card = document.createElement("div");
			card.className = "rcx-card";
			card.setAttribute("aria-label", t("panel.title"));

			// Header
			const head = document.createElement("div");
			head.className = "rcx-head";
			const titleRow = document.createElement("div");
			titleRow.className = "rcx-titleRow";
			const title = document.createElement("span");
			title.className = "rcx-title";
			title.textContent = t("panel.title");
			pathEl = document.createElement("span");
			pathEl.className = "rcx-path";
			pathEl.title = t("entry.tooltip");
			pathEl.addEventListener("click", () => {
				const input = document.createElement("input");
				input.type = "text";
				input.className = "rcx-pathInput";
				input.value = pathEl.textContent;
				input.spellcheck = false;
				pathEl.replaceWith(input);
				input.focus();
				input.select();
				const commit = () => {
					const trimmed = input.value.trim();
					if (trimmed.startsWith("/") && trimmed !== pathEl.textContent) {
						customPath = trimmed;
					} else if (!trimmed.startsWith("/")) {
						customPath = null;
					}
					input.replaceWith(pathEl);
					updatePath();
					if (customPath !== null) loadFile();
				};
				input.addEventListener("blur", commit);
				input.addEventListener("keydown", (event) => {
					event.stopPropagation();
					if (event.key === "Enter") { event.preventDefault(); commit(); }
					if (event.key === "Escape") { event.stopPropagation(); input.replaceWith(pathEl); updatePath(); }
				});
			});
			const closeBtn = document.createElement("button");
			closeBtn.type = "button";
			closeBtn.className = "rcx-closeBtn";
			closeBtn.setAttribute("aria-label", t("action.close"));
			closeBtn.textContent = "\u00d7";
			closeBtn.addEventListener("click", onClose);
			titleRow.append(title, pathEl, closeBtn);
			head.append(titleRow);
			card.append(head);

			// Mode tabs: Context | Agents
			const modeTabs = document.createElement("div");
			modeTabs.className = "rcx-modeTabs";
			const modeContext = document.createElement("button");
			modeContext.type = "button";
			modeContext.className = "rcx-modeTab";
			modeContext.textContent = t("mode.context");
			const modeAgents = document.createElement("button");
			modeAgents.type = "button";
			modeAgents.className = "rcx-modeTab rcx-modeTabOn";
			modeAgents.textContent = t("mode.agents");
			const modeHint = document.createElement("span");
			modeHint.className = "rcx-modeHint";
			const agentsView = createAgentsView();
			const contextBody = document.createElement("div");
			contextBody.className = "rcx-body";
			contextBody.style.display = "none";
			const setMode = (next) => {
				modeContext.className = next === "context" ? "rcx-modeTab rcx-modeTabOn" : "rcx-modeTab";
				modeAgents.className = next === "agents" ? "rcx-modeTab rcx-modeTabOn" : "rcx-modeTab";
				modeHint.textContent = next === "context" ? t("mode.context.hint") : t("mode.agents.hint");
				contextBody.style.display = next === "context" ? "" : "none";
				agentsView.root.style.display = next === "agents" ? "" : "none";
				if (next === "agents") agentsView.refresh();
			};
			modeContext.addEventListener("click", () => setMode("context"));
			modeAgents.addEventListener("click", () => setMode("agents"));
			modeTabs.append(modeContext, modeAgents, modeHint);
			card.append(modeTabs);
			card.append(agentsView.root, contextBody);

			// Tabs
			const tabs = document.createElement("div");
			tabs.className = "rcx-tabs";
			const tabGlobal = document.createElement("button");
			tabGlobal.type = "button";
			tabGlobal.className = "rcx-tab rcx-tabOn";
			tabGlobal.textContent = t("tab.global");
			const tabWorkspace = document.createElement("button");
			tabWorkspace.type = "button";
			tabWorkspace.className = "rcx-tab";
			tabWorkspace.textContent = t("tab.workspace");
			tabHintEl = document.createElement("span");
			tabHintEl.className = "rcx-tabHint";
			const setTab = (next) => {
				tab = next;
				customPath = null;
				tabGlobal.className = next === "global" ? "rcx-tab rcx-tabOn" : "rcx-tab";
				tabWorkspace.className = next === "workspace" ? "rcx-tab rcx-tabOn" : "rcx-tab";
				tabHintEl.textContent = next === "global" ? t("tab.global.hint") : t("tab.workspace.hint");
				pickerEl.style.display = next === "workspace" ? "" : "none";
				sourcesEl.style.display = next === "global" ? "" : "none";
				loadFile();
			};
			tabGlobal.addEventListener("click", () => setTab("global"));
			tabWorkspace.addEventListener("click", () => setTab("workspace"));
			tabs.append(tabGlobal, tabWorkspace, tabHintEl);
			contextBody.append(tabs);

			// Sources section (Global tab only) — scan + switch AGENTS.md default
			const sourcesEl = document.createElement("div");
			sourcesEl.className = "rcx-sources";
			sourcesEl.style.display = "none"; // hidden by default, shown on Global tab
			const sourcesHead = document.createElement("div");
			sourcesHead.className = "rcx-sourcesHead";
			const sourcesTitle = document.createElement("span");
			sourcesTitle.className = "rcx-sourcesTitle";
			sourcesTitle.textContent = t("sources.title");
			const sourcesHint = document.createElement("span");
			sourcesHint.className = "rcx-sourcesHint";
			sourcesHint.textContent = t("sources.hint");
			sourcesHead.append(sourcesTitle, sourcesHint);
			const sourceList = document.createElement("div");
			sourceList.className = "rcx-sourceList";
			sourcesEl.append(sourcesHead, sourceList);
			contextBody.append(sourcesEl);

			const loadSources = () => {
				fetch(`${API}/sources`).then((res) => res.json()).then((body) => {
					if (body.ok !== true) return;
					sourceList.innerHTML = "";
					for (const source of body.sources) {
						if (!source.exists) continue;
						const row = document.createElement("div");
						row.className = body.currentDefault === source.path ? "rcx-sourceRow rcx-sourceOn" : "rcx-sourceRow";
						row.title = source.path;
						const label = document.createElement("span");
						label.className = "rcx-sourceLabel";
						label.textContent = source.label;
						const meta = document.createElement("span");
						meta.className = "rcx-sourceMeta";
						meta.textContent = `${source.lines} ${t("sources.lines")}`;
						row.append(label, meta);
						if (body.currentDefault === source.path) {
							const badge = document.createElement("span");
							badge.className = "rcx-sourceMeta";
							badge.style.color = "var(--dsw-alias-state-business-primary)";
							badge.textContent = "\u2713 " + t("sources.current");
							row.append(badge);
						} else if (!source.path.includes("/.dsh/")) {
							const btn = document.createElement("button");
							btn.type = "button";
							btn.className = "rcx-sourceBtn";
							btn.textContent = t("sources.set_default");
							btn.addEventListener("click", (event) => {
								event.stopPropagation();
								fetch(`${API}/default`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ target: source.path }) })
									.then((res) => res.json())
									.then(() => { loadSources(); loadFile(); });
							});
							row.append(btn);
						}
						sourceList.append(row);
					}
					// Reset button if a symlink is active
					if (body.currentDefault !== null) {
						const resetRow = document.createElement("div");
						resetRow.className = "rcx-sourceRow";
						const resetBtn = document.createElement("button");
						resetBtn.type = "button";
						resetBtn.className = "rcx-sourceBtn";
						resetBtn.textContent = t("sources.reset");
						resetBtn.addEventListener("click", () => {
							fetch(`${API}/default`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ target: "", reset: true }) })
								.then((res) => res.json())
								.then(() => { loadSources(); loadFile(); });
						});
						resetRow.append(resetBtn);
						sourceList.append(resetRow);
					}
				}).catch(() => {});
			};
			loadSources();

			// Workspace picker
			pickerEl = document.createElement("div");
			pickerEl.className = "rcx-picker";
			pickerEl.style.display = "none";
			selectEl = document.createElement("select");
			selectEl.className = "rcx-select";
			selectEl.addEventListener("change", () => { workspace = selectEl.value; loadFile(); });
			pickerEl.append(selectEl);
			contextBody.append(pickerEl);

			// Editor
			const editorWrap = document.createElement("div");
			editorWrap.className = "rcx-editorWrap";
			editorEl = document.createElement("textarea");
			editorEl.className = "rcx-editor";
			editorEl.spellcheck = false;
			editorEl.placeholder = t("editor.placeholder");
			editorEl.addEventListener("input", () => { content = editorEl.value; updateDirty(); });
			editorEl.addEventListener("keydown", (event) => {
				if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); saveBtnEl.click(); }
				if (event.key === "Escape") { event.stopPropagation(); onClose(); }
			});
			editorWrap.append(editorEl);
			contextBody.append(editorWrap);

			// Footer
			const footer = document.createElement("div");
			footer.className = "rcx-footer";
			statusEl = document.createElement("span");
			statusEl.className = "rcx-status";
			saveBtnEl = document.createElement("button");
			saveBtnEl.type = "button";
			saveBtnEl.className = "rcx-saveBtn";
			saveBtnEl.textContent = t("action.save");
			saveBtnEl.disabled = true;
			saveBtnEl.addEventListener("click", () => {
				busy = true;
				saveBtnEl.disabled = true;
				const body = customPath !== null ? { scope: "custom", path: customPath, content } : { scope: tab, workspace, content };
				saveFile(body).then((result) => {
					if (result.ok !== true) throw new Error(result.error);
					saved = content;
					setStatus("ok", `${t("action.saved")} — ${customPath !== null ? result.path : tab === "global" ? t("effect.global") : t("effect.workspace")}`);
				}).catch((cause) => {
					setStatus("error", `${t("error.generic")}: ${cause.message}`);
				}).finally(() => {
					busy = false;
					updateDirty();
				});
			});
			footer.append(statusEl, saveBtnEl);
			contextBody.append(footer);

			scrim.append(card);

			// --- Init ---
			fetchState().then((body) => {
				if (body.ok !== true) return;
				state = body;
				for (const slug of body.workspaces ?? []) {
					const option = document.createElement("option");
					option.value = slug;
					option.textContent = slug;
					selectEl.append(option);
				}
				loadFile();
			}).catch(() => {});
			setMode("agents");
			setTab("global");

			return scrim;
		}
		//#endregion
		//#region lib/index.js
		const inject = ["locale"];
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { en, zh }), "rich-context: dictionaries");

			let open = false;
			let listeners = new Set();
			let panel = null;
			const isOpen = () => open;
			const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
			const setOpen = (value) => {
				if (open === value) return;
				open = value;
				for (const listener of [...listeners]) listener();
			};
			const teardown = () => {
				setOpen(false);
				if (panel !== null) { panel.remove(); panel = null; }
			};
			const toggle = () => {
				if (open) { teardown(); return; }
				panel = createPanel(() => teardown());
				document.body.appendChild(panel);
				setOpen(true);
			};

			const SIDEBAR_ROW_SELECTOR = '[class*="sessionRow"], [class*="projectRow"], [class*="searchResultRow"], [class*="searchResultWorkspace"], [class*="newSession"]';
			const onSidebarClick = (event) => {
				if (!open) return;
				const target = event.target;
				if (target !== null && target.closest?.(SIDEBAR_ROW_SELECTOR) !== null) teardown();
			};
			document.addEventListener("click", onSidebarClick, true);

			const disposeEntry = mountSidebarEntry(toggle, isOpen, subscribe);

			return () => {
				document.removeEventListener("click", onSidebarClick, true);
				teardown();
				disposeEntry();
			};
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
