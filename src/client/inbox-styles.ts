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
`
