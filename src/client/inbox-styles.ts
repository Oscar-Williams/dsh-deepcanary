/** Opaque surfaces: Host menu tokens may contain alpha and are unsuitable for a floating Inbox. */
export const inboxStyles = `
.dsc-panel{--dsc-surface:#ffffff;--dsc-subtle:#f6f8fc;--dsc-ink:#182238;--dsc-muted:#56657b;--dsc-border:#dde4ef;--dsc-blue:#365fe9;background:var(--dsc-surface);color:var(--dsc-ink);border:1px solid var(--dsc-border);border-radius:18px;box-shadow:0 20px 64px rgba(20,35,65,.22),0 2px 8px rgba(20,35,65,.08);isolation:isolate;font:14px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
body[data-ds-dark-theme] .dsc-panel{--dsc-surface:#1c2330;--dsc-subtle:#242e3e;--dsc-ink:#edf2fb;--dsc-muted:#b3bfd2;--dsc-border:#39465b;--dsc-blue:#9aafff;box-shadow:0 20px 64px rgba(0,0,0,.45)}
.dsc-panel .dsc-header{min-height:76px;padding:16px 20px;gap:12px;border-color:var(--dsc-border);border-radius:18px 18px 0 0;background:var(--dsc-surface)}
.dsc-panel .dsc-title{font-size:19px;font-weight:650;letter-spacing:-.025em;line-height:1.35}
.dsc-panel .dsc-subtitle{color:var(--dsc-muted);font-size:12px;line-height:1.5;margin-top:3px}
.dsc-panel .dsc-header-count{padding:2px 9px;border-radius:7px;background:var(--dsc-subtle);color:var(--dsc-muted);font-size:13px}
.dsc-panel .dsc-icon-button{width:34px;height:34px;color:var(--dsc-muted)}
.dsc-panel .dsc-toolbar{display:grid;grid-template-columns:1fr auto;gap:9px;padding:13px 20px;background:var(--dsc-subtle);border-color:var(--dsc-border)}
.dsc-panel .dsc-status{grid-column:1/-1;white-space:normal;color:var(--dsc-muted);font-size:12px;line-height:1.5}
.dsc-panel .dsc-toolbar-button{width:auto;min-height:32px;padding:5px 10px;background:var(--dsc-surface);border-color:var(--dsc-border);color:var(--dsc-ink);font-size:12px;justify-self:start}
.dsc-panel .dsc-body{padding:16px 20px 20px;background:var(--dsc-surface);border-radius:0 0 18px 18px;scrollbar-gutter:stable}
.dsc-panel .dsc-group-title{margin:0 0 12px;color:var(--dsc-muted);font-size:12px;font-weight:600;letter-spacing:0;text-transform:none}
.dsc-panel .dsc-card{gap:10px;margin:0 0 12px;padding:16px;background:var(--dsc-surface);border-color:var(--dsc-border);border-radius:12px}
.dsc-panel .dsc-card[data-selected="true"]{border-color:var(--dsc-blue);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsc-blue) 15%,transparent)}
.dsc-panel .dsc-card-head{display:grid;grid-template-columns:auto 1fr auto;gap:6px 9px;align-items:center}
.dsc-panel .dsc-card-reason{grid-column:1/-1;grid-row:2;overflow:visible;white-space:normal;overflow-wrap:anywhere;color:var(--dsc-ink);font-size:15px;font-weight:600;line-height:1.55}
.dsc-panel .dsc-level-label{color:var(--dsc-muted);font-size:12px;font-weight:500}
.dsc-panel .dsc-card-time{color:var(--dsc-muted);font-size:12px;font-variant-numeric:tabular-nums}
.dsc-panel .dsc-level{height:23px;min-width:29px;font-size:11px;background:#fff1d8;color:#8b5300}
.dsc-panel .dsc-level[data-level="C1"]{background:var(--dsc-subtle);color:var(--dsc-muted)}
.dsc-panel .dsc-level[data-level="C3"]{background:#ffe9e7;color:#a82c29}
.dsc-panel .dsc-card-suggestion,.dsc-panel .dsc-evidence,.dsc-panel .dsc-settings-hint,.dsc-panel .dsc-suppressed-summary{color:var(--dsc-muted);font-size:12px;line-height:1.6}
.dsc-panel .dsc-card-suggestion{margin:0}
.dsc-panel .dsc-card-actions{gap:8px;margin-top:3px}
.dsc-panel .dsc-card-action,.dsc-panel .dsc-more summary{min-height:34px;padding:6px 11px;box-sizing:border-box;border-color:var(--dsc-border);background:var(--dsc-surface);color:var(--dsc-muted);font-size:12px;border-radius:8px}
.dsc-panel .dsc-card-action[data-primary="true"]{background:var(--dsc-blue);border-color:var(--dsc-blue);color:#fff}
body[data-ds-dark-theme] .dsc-panel .dsc-card-action[data-primary="true"]{color:#182238}
.dsc-panel .dsc-card-action:hover:not(:disabled),.dsc-panel .dsc-more summary:hover,.dsc-panel .dsc-toolbar-button:hover{background:var(--dsc-subtle)}
.dsc-panel .dsc-card-action[data-primary="true"]:hover:not(:disabled){background:var(--dsc-blue);filter:brightness(.95)}
.dsc-panel button:focus-visible,.dsc-panel summary:focus-visible{outline:2px solid var(--dsc-blue);outline-offset:3px}
.dsc-panel .dsc-more-actions{background:var(--dsc-surface);border-color:var(--dsc-border);padding:10px;gap:8px}
.dsc-panel .dsc-evidence summary{line-height:1.65}
.dsc-panel .dsc-policy-details{margin:0 0 16px;padding:10px 12px;background:var(--dsc-subtle);border-radius:9px;color:var(--dsc-muted);font-size:12px}
.dsc-panel .dsc-policy-details>summary{cursor:pointer;font-weight:500}
.dsc-panel .dsc-policy-summary{font-size:12px;color:var(--dsc-ink);margin:10px 0 6px}
.dsc-panel .dsc-policy-details .dsc-settings-hint{margin:6px 0}
.dsc-panel .dsc-note{color:var(--dsc-muted);padding:20px 0}
.dsc-panel .dsc-note strong{color:var(--dsc-ink);font-size:15px}
.dsc-panel .dsc-scheduled{margin-top:20px;border-top:1px solid var(--dsc-border);padding-top:14px}
.dsc-panel .dsc-scheduled>summary{color:var(--dsc-ink);font-size:13px;font-weight:600;cursor:pointer;padding:4px 0;line-height:1.6}
.dsc-panel .dsc-scheduled>.dsc-card-suggestion{margin:6px 0 14px}
.dsc-panel .dsc-scheduled-time{margin:0;padding:7px 10px;border-radius:7px;background:var(--dsc-subtle);color:var(--dsc-blue);font-size:12px;line-height:1.6;overflow-wrap:anywhere}
@media(max-width:480px){.dsc-panel .dsc-header{padding:14px}.dsc-panel .dsc-toolbar{padding:12px 14px}.dsc-panel .dsc-body{padding:14px}.dsc-panel .dsc-card{padding:13px}.dsc-panel .dsc-card-head{gap:6px}.dsc-panel .dsc-toolbar-button{font-size:11px}.dsc-panel .dsc-card-reason{font-size:14px}}
@media(forced-colors:active){.dsc-panel{background:Canvas;color:CanvasText;border-color:CanvasText}.dsc-panel .dsc-card-action[data-primary="true"]{background:Highlight;color:HighlightText}}

.dsc-panel.dsc-workbench{right:auto;bottom:auto;min-width:0;min-height:0;max-width:none;max-height:none;overflow:visible;border-radius:16px;outline:none;z-index:30;box-shadow:0 18px 70px #14234129,0 2px 10px #14234110}
.dsc-workbench .dsc-window-titlebar{min-height:64px;padding:12px 18px;gap:12px;touch-action:none;user-select:none;border-radius:16px 16px 0 0;cursor:move}
.dsc-workbench .dsc-title{margin:0;font-size:19px;line-height:24px;letter-spacing:-.4px;font-weight:650}
.dsc-workbench .dsc-subtitle{font-size:12px;margin:0;line-height:18px}
.dsc-workbench .dsc-window-button{appearance:none;display:inline-flex;align-items:center;justify-content:center;min-height:32px;min-width:36px;border:0;background:transparent;color:var(--dsc-muted);padding:6px 8px;border-radius:7px;font:inherit;font-size:12px;white-space:nowrap;cursor:pointer;list-style:none}
.dsc-workbench .dsc-window-button:hover{background:var(--dsc-subtle);color:var(--dsc-ink)}
.dsc-workbench .dsc-layout-menu{position:relative}
.dsc-workbench .dsc-layout-menu summary::-webkit-details-marker,.dsc-workbench .dsc-health-menu summary::-webkit-details-marker{display:none}
.dsc-workbench .dsc-layout-actions{position:absolute;right:0;top:calc(100% + 8px);display:flex;flex-direction:column;min-width:180px;padding:6px;background:var(--dsc-surface);border:1px solid var(--dsc-border);border-radius:10px;box-shadow:0 8px 28px #14234129;z-index:10}
.dsc-workbench .dsc-layout-actions button{border:0;background:none;text-align:left;color:var(--dsc-ink);font:inherit;font-size:13px;padding:9px 12px;border-radius:6px;cursor:pointer}
.dsc-workbench .dsc-layout-actions button:hover{background:var(--dsc-subtle)}
.dsc-workbench .dsc-inbox-tabs{display:flex;align-items:stretch;flex:none;gap:20px;min-height:47px;padding:0 20px;border-bottom:1px solid var(--dsc-border)}
.dsc-workbench .dsc-inbox-tab,.dsc-workbench .dsc-settings-link{display:flex;align-items:center;gap:6px;background:none;border:0;border-bottom:2px solid transparent;padding:9px 0;font:inherit;font-size:13px;color:var(--dsc-muted);cursor:pointer;white-space:nowrap}
.dsc-workbench .dsc-inbox-tab[aria-current=page]{border-bottom-color:var(--dsc-blue);color:var(--dsc-blue);font-weight:600}
.dsc-workbench .dsc-tab-count{font-size:11px;padding:0 5px;border-radius:5px;background:var(--dsc-subtle);color:var(--dsc-muted);font-variant-numeric:tabular-nums}
.dsc-workbench .dsc-settings-link{margin-left:auto;font-size:12px}
.dsc-workbench .dsc-workspace{display:grid;grid-template-columns:var(--dsc-list-width) 5px minmax(0,1fr);flex:1;min-height:0;overflow:hidden}
.dsc-workbench .dsc-task-list{overflow:auto;min-width:0;padding:8px 0;scrollbar-gutter:stable}
.dsc-workbench .dsc-task-group-label{padding:14px 20px 8px;color:var(--dsc-muted);font-size:11px;font-weight:600}
.dsc-workbench .dsc-task-row{display:flex;align-items:flex-start;gap:10px;width:100%;padding:16px 14px 16px 20px;min-height:87px;border:0;border-bottom:1px solid var(--dsc-border);background:transparent;text-align:left;color:var(--dsc-ink);font:inherit;cursor:pointer}
.dsc-workbench .dsc-task-row:hover{background:var(--dsc-subtle)}
.dsc-workbench .dsc-task-row[aria-selected=true]{background:color-mix(in srgb,var(--dsc-blue) 8%,var(--dsc-surface));box-shadow:inset 3px 0 var(--dsc-blue)}
.dsc-workbench .dsc-row-marker{width:6px;height:6px;flex:none;margin-top:8px;background:#bb7514;border-radius:50%}
.dsc-workbench .dsc-task-row[data-level=C3] .dsc-row-marker{background:#cf463e}
.dsc-workbench .dsc-task-row[data-level=C1] .dsc-row-marker{background:var(--dsc-muted)}
.dsc-workbench .dsc-row-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
.dsc-workbench .dsc-row-title{font-size:14px;font-weight:550;line-height:21px;overflow-wrap:anywhere}
.dsc-workbench .dsc-row-meta{font-size:11px;color:var(--dsc-muted);line-height:17px;overflow-wrap:anywhere}
.dsc-workbench .dsc-row-time{font-size:11px;color:var(--dsc-muted);font-variant-numeric:tabular-nums;flex:none;margin-top:2px}
.dsc-workbench .dsc-local-context-menu{position:fixed;z-index:20;min-width:180px;padding:6px;background:var(--dsc-surface);border:1px solid var(--dsc-border);border-radius:10px;box-shadow:0 8px 28px #14234129}
.dsc-workbench .dsc-local-context-menu button{display:block;width:100%;padding:9px 12px;text-align:left;background:none;border:0;border-radius:5px;font:inherit;color:var(--dsc-ink);cursor:pointer}
.dsc-workbench .dsc-local-context-menu button:hover,.dsc-workbench .dsc-local-context-menu button:focus-visible{background:var(--dsc-subtle);outline:2px solid var(--dsc-blue);outline-offset:-2px}
.dsc-workbench .dsc-splitter{background:var(--dsc-border);border:2px solid var(--dsc-surface);cursor:col-resize;touch-action:none}
.dsc-workbench .dsc-splitter:hover,.dsc-workbench .dsc-splitter:focus-visible{background:var(--dsc-blue)}
.dsc-workbench .dsc-task-detail{min-width:0;overflow:auto;padding:28px 26px}
.dsc-workbench .dsc-task-detail .dsc-card{padding:0;border:0;box-shadow:none;background:transparent;gap:16px;margin:0}
.dsc-workbench .dsc-task-detail .dsc-card-head{gap:10px;grid-template-columns:auto 1fr auto}
.dsc-workbench .dsc-task-detail .dsc-card-reason{font-size:19px;font-weight:600;line-height:1.5;margin-top:8px}
.dsc-workbench .dsc-task-detail .dsc-card-copy{color:var(--dsc-ink);font-size:14px;line-height:1.7}
.dsc-workbench .dsc-task-detail .dsc-card-suggestion{font-size:13px;line-height:1.7}
.dsc-workbench .dsc-task-detail .dsc-card-actions{gap:8px;margin-top:8px}
.dsc-workbench .dsc-task-detail .dsc-evidence{padding-top:16px;border-top:1px solid var(--dsc-border);font-size:12px}
.dsc-workbench .dsc-detail-empty,.dsc-workbench .dsc-empty{display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;height:100%;box-sizing:border-box;padding:24px;color:var(--dsc-muted);gap:10px}
.dsc-workbench .dsc-detail-empty strong,.dsc-workbench .dsc-empty strong{color:var(--dsc-ink);font-size:15px;font-weight:550}
.dsc-workbench .dsc-detail-empty p,.dsc-workbench .dsc-empty p{margin:0;max-width:240px;font-size:13px;line-height:1.8}
.dsc-workbench .dsc-inbox-footer{display:flex;align-items:center;flex:none;gap:12px;min-height:39px;box-sizing:border-box;padding:8px 18px;border-top:1px solid var(--dsc-border);color:var(--dsc-muted);font-size:11px;border-radius:0 0 16px 16px;background:var(--dsc-subtle)}
.dsc-workbench .dsc-health-menu{position:relative;flex:none}
.dsc-workbench .dsc-health-menu>summary{display:flex;align-items:center;gap:7px;cursor:pointer;list-style:none}
.dsc-workbench .dsc-health-popup{position:absolute;left:0;bottom:calc(100% + 16px);width:min(340px,calc(100vw - 64px));padding:16px;border:1px solid var(--dsc-border);border-radius:10px;background:var(--dsc-surface);color:var(--dsc-muted);box-shadow:0 8px 28px #14234129;z-index:10;font-size:12px}
.dsc-workbench .dsc-health-popup p{margin:0 0 12px;line-height:1.7}
.dsc-workbench .dsc-footer-notice{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsc-workbench .dsc-refresh-link,.dsc-workbench .dsc-back,.dsc-workbench .dsc-load-more{font:inherit;font-size:12px;border:0;background:none;color:var(--dsc-blue);padding:5px 0;cursor:pointer;flex:none}
.dsc-workbench .dsc-back{margin-bottom:16px}
.dsc-workbench .dsc-load-more{display:block;width:100%;padding:14px}
.dsc-workbench .dsc-settings-view{flex:1;min-height:0;overflow:auto;padding:8px 24px 24px}
.dsc-workbench .dsc-settings-card{border:0;background:none;margin:0}
.dsc-workbench .dsc-keyboard-hint{flex:none;background:var(--dsc-subtle);color:var(--dsc-blue);font-size:12px;margin:0;padding:8px 18px}
.dsc-workbench .dsc-resize-edge{position:absolute;z-index:5;touch-action:none}
.dsc-workbench .dsc-resize-edge[data-edge=n]{top:-3px;left:16px;right:16px;height:6px;cursor:ns-resize}
.dsc-workbench .dsc-resize-edge[data-edge=s]{bottom:-3px;left:16px;right:16px;height:6px;cursor:ns-resize}
.dsc-workbench .dsc-resize-edge[data-edge=e]{right:-3px;top:16px;bottom:16px;width:6px;cursor:ew-resize}
.dsc-workbench .dsc-resize-edge[data-edge=w]{left:-3px;top:16px;bottom:16px;width:6px;cursor:ew-resize}
.dsc-workbench .dsc-resize-edge[data-edge=ne],.dsc-workbench .dsc-resize-edge[data-edge=nw],.dsc-workbench .dsc-resize-edge[data-edge=se],.dsc-workbench .dsc-resize-edge[data-edge=sw]{width:16px;height:16px}
.dsc-workbench .dsc-resize-edge[data-edge=ne]{right:-3px;top:-3px;cursor:nesw-resize}
.dsc-workbench .dsc-resize-edge[data-edge=nw]{left:-3px;top:-3px;cursor:nwse-resize}
.dsc-workbench .dsc-resize-edge[data-edge=se]{right:-3px;bottom:-3px;cursor:nwse-resize}
.dsc-workbench .dsc-resize-edge[data-edge=sw]{left:-3px;bottom:-3px;cursor:nesw-resize}
.dsc-workbench .dsc-resize-edge:focus-visible{outline:2px solid var(--dsc-blue);outline-offset:2px}
.dsc-panel.dsc-workbench[data-wide=false] .dsc-workspace{display:flex;flex-direction:column}
.dsc-workbench[data-wide=false] .dsc-task-list{flex:1}
.dsc-workbench[data-wide=false] .dsc-workspace[data-detail=true] .dsc-task-list{display:none}
.dsc-workbench[data-wide=false] .dsc-workspace[data-detail=false] .dsc-task-detail{display:none}
.dsc-workbench[data-wide=false] .dsc-task-detail{padding:20px;flex:1}
@media(max-width:480px){.dsc-workbench .dsc-window-titlebar{padding:10px 12px;gap:4px}.dsc-workbench .dsc-mark{display:none}.dsc-workbench .dsc-inbox-tabs{padding:0 12px;gap:12px}.dsc-workbench .dsc-settings-link{font-size:11px}.dsc-workbench .dsc-title{font-size:18px}.dsc-workbench .dsc-subtitle{display:none}.dsc-workbench .dsc-inbox-footer{padding:8px 12px;gap:8px}.dsc-workbench .dsc-task-detail{padding:18px}}
@media(prefers-reduced-motion:no-preference){.dsc-workbench .dsc-task-row{transition:background-color .12s ease}.dsc-workbench .dsc-window-button{transition:background-color .12s ease}}
@media(forced-colors:active){.dsc-panel.dsc-workbench{background:Canvas;color:CanvasText;border-color:CanvasText}.dsc-workbench .dsc-task-row[aria-selected=true]{background:Highlight;color:HighlightText}.dsc-workbench .dsc-row-meta,.dsc-workbench .dsc-row-time{color:inherit}.dsc-workbench .dsc-row-marker{background:CanvasText}.dsc-workbench .dsc-inbox-tab[aria-current=page]{border-color:Highlight}.dsc-workbench button:focus-visible,.dsc-workbench summary:focus-visible{outline:2px solid Highlight}}
`
