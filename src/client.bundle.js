window.__ModuleLoader__.load({
	id: "dsh-rich-context",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		//#region lib/locale.js
		const NS = "rich-context";
		const en = {
			"entry.label": "Context",
			"entry.tooltip": "Manage AGENTS.md — the instruction files your agents read",
			"panel.title": "Agent context",
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
		};
		const zh = {
			"entry.label": "上下文",
			"entry.tooltip": "管理 AGENTS.md——agent 实际读取的指令文件",
			"panel.title": "Agent 上下文",
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
.rcx-card{width:100%;max-width:960px;max-height:min(88vh,780px);border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-specific-tip);border-radius:12px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.3)}
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
.rcx-editor{flex:1;min-height:120px;height:100%;width:100%;resize:none;border:none;outline:none;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:ui-monospace,monospace;font-size:12.5px;line-height:19px;padding:10px 16px;scrollbar-width:none}
.rcx-editor::-webkit-scrollbar{display:none}
.rcx-empty{padding:2px 16px;color:var(--dsw-alias-label-caption);font-size:11px;line-height:14px}
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
		//#endregion
		//#region lib/sidebar.js
		const ENTRY_ATTR = "data-dsh-rich-context-entry";
		const FAMILY = ["[data-dsh-taskboard-entry]", "[data-dsh-ssh-entry]", "[data-dsh-skill-explorer-entry]", "[data-dsh-generative-ideas-entry]", `[${ENTRY_ATTR}]`];
		const ICON = `<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 2.5h7.5L13 5v8.5H3z"/><path d="M5.5 7h5M5.5 9.5h5M5.5 12h3"/></svg>`;

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
				const p = customPath !== null ? customPath : tab === "global" ? (state?.globalPath ?? "~/.dsh/AGENTS.md") : workspace !== "" ? `/${workspace.replaceAll("--", "/")}/AGENTS.md` : "";
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
				loadFile();
			};
			tabGlobal.addEventListener("click", () => setTab("global"));
			tabWorkspace.addEventListener("click", () => setTab("workspace"));
			tabs.append(tabGlobal, tabWorkspace, tabHintEl);
			card.append(tabs);

			// Workspace picker
			pickerEl = document.createElement("div");
			pickerEl.className = "rcx-picker";
			pickerEl.style.display = "none";
			selectEl = document.createElement("select");
			selectEl.className = "rcx-select";
			selectEl.addEventListener("change", () => { workspace = selectEl.value; loadFile(); });
			pickerEl.append(selectEl);
			card.append(pickerEl);

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
			card.append(editorWrap);

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
			card.append(footer);

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
