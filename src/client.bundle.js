window.__ModuleLoader__.load({
	id: "dsh-rich-context",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		let react = require("react");
		let react_dom_client = require("react-dom/client");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region lib/locale.js
		const NS = "rich-context";
		const en = {
			"entry.label": "Context",
			"entry.tooltip": "Manage AGENTS.md — the instruction files your agents read",
			"panel.title": "Agent context",
			"panel.subtitle": "The AGENTS.md files the harness loads into every session",
			"tab.global": "Global",
			"tab.workspace": "Workspace",
			"tab.global.hint": "~/.dsh/AGENTS.md — applies to every session",
			"tab.workspace.hint": "<workspace>/AGENTS.md — applies to that workspace's sessions",
			"workspace.placeholder": "Select a workspace…",
			"editor.placeholder": "This file is empty — start with a template below, or write your rules.",
			"editor.empty": "No file yet — saving creates it.",
			"templates.title": "Templates",
			"templates.hint": "Insert a titled section into the editor",
			"templates.saveAs": "Save selection as template",
			"templates.delete": "Delete template",
			"templates.deleted": "deleted",
			"templates.conflict": "name it first",
			"action.save": "Save",
			"action.saved": "saved",
			"action.saving": "saving…",
			"action.dirty": "unsaved changes",
			"action.close": "Close",
			"error.generic": "failed",
			"effect.global": "Applies to new sessions immediately.",
			"effect.workspace": "Workspace sessions pick this up through file-activity sync."
		};
		const zh = {
			"entry.label": "上下文",
			"entry.tooltip": "管理 AGENTS.md——你的 agent 实际读取的指令文件",
			"panel.title": "Agent 上下文",
			"panel.subtitle": "harness 加载进每个会话的 AGENTS.md 指令文件",
			"tab.global": "全局",
			"tab.workspace": "工作区",
			"tab.global.hint": "~/.dsh/AGENTS.md——作用于所有会话",
			"tab.workspace.hint": "<工作区>/AGENTS.md——只作用于该工作区",
			"workspace.placeholder": "选择工作区…",
			"editor.placeholder": "文件为空——从下面的模板开始，或直接写你的规则。",
			"editor.empty": "尚无文件——保存即创建。",
			"templates.title": "模板",
			"templates.hint": "向编辑器插入一个带标题的小节",
			"templates.saveAs": "把选中内容存为模板",
			"templates.delete": "删除模板",
			"templates.deleted": "已删除",
			"templates.conflict": "请先命名",
			"action.save": "保存",
			"action.saved": "已保存",
			"action.saving": "保存中…",
			"action.dirty": "有未保存修改",
			"action.close": "关闭",
			"error.generic": "失败",
			"effect.global": "对新会话立即生效。",
			"effect.workspace": "工作区会话通过文件活动同步感知变更。"
		};
		let dict = { en, zh };
		const lang = (typeof navigator !== "undefined" && /^(zh)/i.test(navigator.language ?? "")) ? "zh" : "en";
		const t = (key) => dict[lang][key] ?? dict.en[key] ?? key;
		//#endregion
		//#region lib/sidebar.js
		/** Stable data attribute + family ordering (task-board → ssh → skill-explorer → rich-context). */
		const ENTRY_ATTR = "data-dsh-rich-context-entry";
		const FAMILY = ["[data-dsh-taskboard-entry]", "[data-dsh-ssh-entry]", "[data-dsh-skill-explorer-entry]", `[${ENTRY_ATTR}]`];
		const ICON = "<svg viewBox=\"0 0 16 16\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 2.5h7.5L13 5v8.5H3z\"/><path d=\"M5.5 7h5M5.5 9.5h5M5.5 12h3\"/></svg>";

		function sidebarRoot() {
			const column = document.querySelector("[data-pane=\"sidebar\"], [class*=\"sidebarCol\"]");
			if (column === null) return undefined;
			return column.querySelector("[class*=\"logoRow\"]")?.parentElement ?? column.firstElementChild ?? undefined;
		}
		function newSessionButton(root) {
			const nested = root.querySelector("button[class*=\"newSession\"]");
			if (nested !== null) return nested;
			for (const child of root.children) if (child.tagName === "BUTTON") return child;
			return undefined;
		}
		/** Self-healing sidebar entry (task-board's proven core, compact local copy). */
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
					const row = button.closest("[class*=\"logoRow\"]");
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
				const sync = () => { if (isActive()) entry.dataset.active = "true"; else delete entry.dataset.active; };
				unsubscribe = subscribe(sync);
				sync();
			}
			tryPlace();
			return () => {
				waitObserver.disconnect();
				rootObserver.disconnect();
				unsubscribe?.();
				entry.remove();
			};
		}
		//#endregion
		//#region lib/styles.js
		const css = `.rcx-entry{appearance:none;display:flex;align-items:center;gap:8px;width:100%;height:36px;padding:0 10px;font:inherit;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:8px;cursor:pointer;text-align:left}
.rcx-entry:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.rcx-entry[data-active="true"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.rcx-entryIcon{justify-content:center;align-items:center;width:24px;height:24px;display:inline-flex;flex:none;color:var(--dsw-alias-label-tertiary)}
.rcx-entryLabel{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rcx-scrim{position:fixed;inset:0;z-index:90;background:color-mix(in srgb, var(--dsw-alias-bg-mask-2, rgba(0,0,0,.45)) 100%, transparent);display:flex;align-items:center;justify-content:center;padding:24px}
.rcx-card{width:100%;max-width:760px;max-height:min(80vh,640px);border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-specific-tip);border-radius:12px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 24px var(--dsw-alias-bg-mask-2, rgba(0,0,0,.35))}
.rcx-card,.rcx-card *{box-sizing:border-box}
.rcx-head{display:flex;flex-direction:column;gap:2px;padding:14px 0 10px}
.rcx-titleRow{display:flex;align-items:baseline;gap:8px;padding:0 16px}
.rcx-title{font-size:14px;font-weight:500;line-height:20px;color:var(--dsw-alias-label-primary)}
.rcx-path{min-width:0;flex:1;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:16px;font-family:ui-monospace,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rcx-closeBtn{flex:none;width:28px;height:28px;display:grid;place-items:center;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:999px}
.rcx-closeBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.rcx-subtitle{padding:0 16px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:16px}
.rcx-tabs{display:flex;border-top:1px solid var(--dsw-alias-border-l1);border-bottom:1px solid var(--dsw-alias-border-l1)}
.rcx-tab{appearance:none;background:0 0;border:none;border-right:1px solid var(--dsw-alias-border-l1);padding:8px 16px;font:inherit;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);cursor:pointer}
.rcx-tab:first-child{border-left:none}
.rcx-tabOn{color:var(--dsw-alias-state-business-primary);font-weight:500}
.rcx-tab:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.rcx-tabHint{flex:1;align-self:center;padding:0 12px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rcx-picker{padding:8px 16px 0}
.rcx-select{width:100%;height:30px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);border-radius:8px;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:0 8px}
.rcx-editorWrap{flex:1;min-height:0;display:flex;flex-direction:column;padding:8px 0 0}
.rcx-editor{flex:1;min-height:0;width:100%;resize:none;border:none;outline:none;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:ui-monospace,monospace;font-size:12.5px;line-height:19px;padding:10px 16px;scrollbar-width:none}
.rcx-editor::-webkit-scrollbar{display:none}
.rcx-empty{padding:2px 16px;color:var(--dsw-alias-label-caption);font-size:11px;line-height:14px}
.rcx-templates{border-top:1px solid var(--dsw-alias-border-l1);display:flex;flex-direction:column}
.rcx-templatesHead{display:flex;align-items:baseline;gap:8px;padding:8px 16px 2px}
.rcx-templatesTitle{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:14px;text-transform:uppercase;letter-spacing:.05em}
.rcx-templatesHint{flex:1;color:var(--dsw-alias-label-caption);font-size:11px;line-height:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rcx-templateList{display:flex;flex-wrap:wrap;gap:6px;padding:6px 16px 10px}
.rcx-templateChip{appearance:none;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);border:none;border-radius:999px;padding:3px 10px;font:inherit;font-size:12px;line-height:16px;cursor:pointer}
.rcx-templateChip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);text-decoration:underline}
.rcx-templateChipUser{padding-right:4px;display:inline-flex;align-items:center;gap:2px}
.rcx-templateDel{width:16px;height:16px;display:grid;place-items:center;border:none;background:0 0;color:var(--dsw-alias-label-caption);cursor:pointer;border-radius:999px;font-size:12px;line-height:1}
.rcx-templateDel:hover{color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-interactive-bg-hover)}
.rcx-footer{display:flex;align-items:stretch;border-top:1px solid var(--dsw-alias-border-l1)}
.rcx-status{flex:1;align-self:center;min-width:0;padding:0 12px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rcx-statusErr{color:var(--dsw-alias-state-error-primary)}
.rcx-statusOk{color:var(--dsw-alias-state-success-primary)}
.rcx-saveBtn{appearance:none;background:0 0;border:none;border-left:1px solid var(--dsw-alias-border-l1);padding:9px 20px;font:inherit;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);cursor:pointer}
.rcx-saveBtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.rcx-saveBtn:disabled{opacity:.45;cursor:default}
.rcx-saveDirty{color:var(--dsw-alias-state-business-primary);font-weight:500}`;
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
			const body = await res.json();
			if (!res.ok || body.ok !== true) throw new Error(body.error ?? `state failed: HTTP ${res.status}`);
			return body;
		}
		async function fetchFile(scope, workspace) {
			const params = new URLSearchParams({ scope });
			if (scope === "workspace") params.set("workspace", workspace ?? "");
			const res = await fetch(`${API}/file?${params}`, { cache: "no-store" });
			const body = await res.json();
			if (!res.ok || body.ok !== true) throw new Error(body.error ?? `read failed: HTTP ${res.status}`);
			return body;
		}
		async function saveFile(scope, workspace, content) {
			const res = await fetch(`${API}/file`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ scope, workspace, content }) });
			const body = await res.json();
			if (!res.ok || body.ok !== true) throw new Error(body.error ?? `save failed: HTTP ${res.status}`);
			return body;
		}
		async function putTemplate(id, section) {
			const res = await fetch(`${API}/template`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, section }) });
			const body = await res.json();
			if (!res.ok || body.ok !== true) throw new Error(body.error ?? `template save failed: HTTP ${res.status}`);
			return body;
		}
		async function deleteTemplate(id) {
			const res = await fetch(`${API}/template`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
			const body = await res.json();
			if (!res.ok || body.ok !== true) throw new Error(body.error ?? `template delete failed: HTTP ${res.status}`);
			return body;
		}
		//#endregion
		//#region lib/panel.js
		/** The manager overlay: two tabs (Global / Workspace), editor, templates, save. */
		function ContextPanel({ onClose }) {
			const [state, setState] = (0, react.useState)(null);
			const [tab, setTab] = (0, react.useState)("global");
			const [workspace, setWorkspace] = (0, react.useState)("");
			const [content, setContent] = (0, react.useState)("");
			const [saved, setSaved] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const [status, setStatus] = (0, react.useState)(null);

			(0, react.useEffect)(() => {
				fetchState().then(setState).catch((cause) => setStatus({ kind: "error", text: cause instanceof Error ? cause.message : String(cause) }));
			}, []);

			const loadFile = (0, react.useCallback)((nextTab, nextWorkspace) => {
				setSaved(null);
				setStatus(null);
				fetchFile(nextTab, nextWorkspace).then((body) => { setContent(body.content ?? ""); setSaved(body.content ?? ""); }).catch((cause) => setStatus({ kind: "error", text: cause instanceof Error ? cause.message : String(cause) }));
			}, []);
			(0, react.useEffect)(() => { if (tab === "global") loadFile("global", ""); }, [tab, loadFile]);
			(0, react.useEffect)(() => { if (tab === "workspace" && workspace !== "") loadFile("workspace", workspace); }, [tab, workspace, loadFile]);

			const dirty = content !== (saved ?? "");
			const filePath = tab === "global" ? (state?.globalPath ?? "~/.dsh/AGENTS.md") : workspace !== "" ? `${workspace.replaceAll("--", "/")}/AGENTS.md` : "";

			const save = () => {
				setBusy(true);
				saveFile(tab, workspace, content).then(() => { setSaved(content); setStatus({ kind: "ok", text: `${t("action.saved")} — ${tab === "global" ? t("effect.global") : t("effect.workspace")}` }); }).catch((cause) => setStatus({ kind: "error", text: `${t("error.generic")}: ${cause instanceof Error ? cause.message : String(cause)}` })).finally(() => setBusy(false));
			};

			const insertTemplate = (template) => {
				const block = content.trim() === "" ? template.section : `${content.replace(/\s*$/, "")}\n\n${template.section}\n`;
				setContent(block);
			};
			const saveSelectionAsTemplate = () => {
				const selection = typeof document !== "undefined" ? (document.activeElement?.dataset?.rcxEditor === "true" ? "" : "") : "";
				const name = window.prompt(t("templates.saveAs") + " — name:");
				if (name === null || name.trim() === "") return;
				const section = (window.getSelection?.()?.toString() ?? "").trim() !== "" ? window.getSelection().toString() : content.trim();
				if (section === "") { setStatus({ kind: "error", text: t("templates.conflict") }); return; }
				putTemplate(`user:${name.trim().replaceAll(" ", "-")}`, section).then(() => fetchState().then(setState)).catch((cause) => setStatus({ kind: "error", text: cause instanceof Error ? cause.message : String(cause) }));
			};
			const removeTemplate = (template) => {
				deleteTemplate(template.id).then(() => fetchState().then(setState)).catch((cause) => setStatus({ kind: "error", text: cause instanceof Error ? cause.message : String(cause) }));
			};

			return (0, react_jsx_runtime.jsxs)("div", {
				className: "rcx-scrim",
				onClick: (event) => { if (event.target === event.currentTarget) onClose(); },
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: "rcx-card",
						"aria-label": t("panel.title"),
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: "rcx-head",
								children: [
									(0, react_jsx_runtime.jsxs)("div", {
										className: "rcx-titleRow",
										children: [
											(0, react_jsx_runtime.jsx)("span", { className: "rcx-title", children: t("panel.title") }),
											(0, react_jsx_runtime.jsx)("span", { className: "rcx-path", children: filePath }),
											(0, react_jsx_runtime.jsx)("button", { type: "button", className: "rcx-closeBtn", "aria-label": t("action.close"), onClick: onClose, children: "\u00d7" })
										]
									}),
									(0, react_jsx_runtime.jsx)("span", { className: "rcx-subtitle", children: t("panel.subtitle") })
								]
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: "rcx-tabs",
								children: [
									(0, react_jsx_runtime.jsx)("button", { type: "button", className: tab === "global" ? "rcx-tab rcx-tabOn" : "rcx-tab", onClick: () => setTab("global"), children: t("tab.global") }),
									(0, react_jsx_runtime.jsx)("button", { type: "button", className: tab === "workspace" ? "rcx-tab rcx-tabOn" : "rcx-tab", onClick: () => setTab("workspace"), children: t("tab.workspace") }),
									(0, react_jsx_runtime.jsx)("span", { className: "rcx-tabHint", children: tab === "global" ? t("tab.global.hint") : t("tab.workspace.hint") })
								]
							}),
							tab === "workspace" ? (0, react_jsx_runtime.jsx)("div", {
								className: "rcx-picker",
								children: (0, react_jsx_runtime.jsx)("select", {
									className: "rcx-select",
									value: workspace,
									onChange: (event) => setWorkspace(event.target.value),
									children: [
										(0, react_jsx_runtime.jsx)("option", { value: "", disabled: true, children: t("workspace.placeholder") }),
										...(state?.workspaces ?? []).map((slug) => (0, react_jsx_runtime.jsx)("option", { value: slug, children: slug }, slug))
									]
								})
							}) : null,
							(0, react_jsx_runtime.jsxs)("div", {
								className: "rcx-editorWrap",
								children: [
									(0, react_jsx_runtime.jsx)("textarea", {
										className: "rcx-editor",
										"data-rcx-editor": "true",
										spellCheck: false,
										value: content,
										placeholder: t("editor.placeholder"),
										onChange: (event) => setContent(event.target.value),
										onKeyDown: (event) => {
											if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); if (!busy && (tab === "global" || workspace !== "")) save(); }
											if (event.key === "Escape") { event.stopPropagation(); onClose(); }
										},
										disabled: tab === "workspace" && workspace === ""
									}),
									(0, react_jsx_runtime.jsx)("span", { className: "rcx-empty", children: saved === null ? t("editor.empty") : null })
								]
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: "rcx-templates",
								children: [
									(0, react_jsx_runtime.jsxs)("div", {
										className: "rcx-templatesHead",
										children: [
											(0, react_jsx_runtime.jsx)("span", { className: "rcx-templatesTitle", children: t("templates.title") }),
											(0, react_jsx_runtime.jsx)("span", { className: "rcx-templatesHint", children: t("templates.hint") }),
											(0, react_jsx_runtime.jsx)("button", { type: "button", className: "rcx-templateChip", onClick: saveSelectionAsTemplate, children: t("templates.saveAs") })
										]
									}),
									(0, react_jsx_runtime.jsx)("div", {
										className: "rcx-templateList",
										children: (state?.templates ?? []).map((template) => (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: template.id.startsWith("user:") ? "rcx-templateChip rcx-templateChipUser" : "rcx-templateChip",
											onClick: () => insertTemplate(template),
											title: template.section.slice(0, 200),
											children: [
												template.name,
												template.id.startsWith("user:") ? (0, react_jsx_runtime.jsx)("span", { role: "button", className: "rcx-templateDel", "aria-label": t("templates.delete"), onClick: (event) => { event.stopPropagation(); removeTemplate(template); }, children: "\u00d7" }) : null
											]
										}, template.id))
									})
								]
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: "rcx-footer",
								children: [
									(0, react_jsx_runtime.jsx)("span", { className: status?.kind === "error" ? "rcx-status rcx-statusErr" : status?.kind === "ok" ? "rcx-status rcx-statusOk" : "rcx-status", role: status?.kind === "error" ? "alert" : "status", children: status?.text ?? (dirty ? t("action.dirty") : "") }),
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: dirty ? "rcx-saveBtn rcx-saveDirty" : "rcx-saveBtn",
										disabled: busy || !dirty || (tab === "workspace" && workspace === ""),
										onClick: save,
										children: busy ? t("action.saving") : t("action.save")
									})
								]
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region lib/index.js
		const inject = ["locale"];
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { en, zh }), "rich-context: dictionaries");

			let open = false;
			let listeners = new Set();
			const isOpen = () => open;
			const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
			const setOpen = (value) => {
				if (open === value) return;
				open = value;
				for (const listener of [...listeners]) listener();
			};

			let container;
			let root;
			const mountPanel = () => {
				container = document.createElement("div");
				container.dataset.dshPlugin = "rich-context";
				container.dataset.dshPart = "panel-root";
				document.body.appendChild(container);
				root = react_dom_client.createRoot(container);
				root.render((0, react_jsx_runtime.jsx)(ContextPanel, { onClose: () => teardownPanel() }));
			};
			const teardownPanel = () => {
				setOpen(false);
				root?.unmount();
				root = undefined;
				container?.remove();
				container = undefined;
			};

			const SIDEBAR_ROW_SELECTOR = "[class*=\"sessionRow\"], [class*=\"projectRow\"], [class*=\"searchResultRow\"], [class*=\"searchResultWorkspace\"], [class*=\"newSession\"]";
			const onSidebarClick = (event) => {
				if (!open) return;
				const target = event.target;
				if (target !== null && target.closest?.(SIDEBAR_ROW_SELECTOR) !== null) teardownPanel();
			};
			document.addEventListener("click", onSidebarClick, true);

			const disposeEntry = mountSidebarEntry(
				() => { if (open) teardownPanel(); else { setOpen(true); mountPanel(); } },
				isOpen,
				subscribe
			);

			return () => {
				document.removeEventListener("click", onSidebarClick, true);
				teardownPanel();
				disposeEntry();
			};
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
