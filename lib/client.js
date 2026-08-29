/* global Notification */
const rootId = 'dsh-deepcanary-root';
const seenKey = 'dsh-deepcanary-notified';
function el(tag, text) {
    const node = document.createElement(tag);
    if (text !== undefined)
        node.textContent = text;
    return node;
}
function button(label, onClick) {
    const node = el('button', label);
    node.type = 'button';
    node.onclick = onClick;
    return node;
}
function notify(items) {
    if (!('Notification' in globalThis) || Notification.permission !== 'granted')
        return;
    let seen;
    try {
        seen = new Set(JSON.parse(localStorage.getItem(seenKey) ?? '[]'));
    }
    catch {
        seen = new Set();
    }
    for (const item of items.filter(item => (item.level === 'C2' || item.level === 'C3') && !seen.has(item.id)).slice(0, 3)) {
        new Notification(`DeepCanary ${item.level}: ${item.reasonCode}`, { body: item.why, tag: item.id });
        seen.add(item.id);
    }
    localStorage.setItem(seenKey, JSON.stringify([...seen].slice(-100)));
}
async function post(path, payload) {
    try {
        return await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    }
    catch {
        return undefined;
    }
}
async function action(id, value) {
    const response = await post('/dsh-deepcanary/action', { id, ...value });
    if (response?.ok)
        await refresh();
}
function field(label, control) {
    const wrapper = el('label');
    wrapper.style.cssText = 'display:grid;gap:3px;color:#4b5563;font-size:12px';
    wrapper.append(el('span', label), control);
    return wrapper;
}
function selectControl(name, values, current) {
    const select = el('select');
    select.name = name;
    select.style.cssText = 'width:100%;padding:5px;border:1px solid #d9dce1;border-radius:6px;background:#fff';
    for (const value of values) {
        const option = el('option', value);
        option.value = value;
        option.selected = value === current;
        select.append(option);
    }
    return select;
}
function numberControl(name, current, min, max) {
    const input = el('input');
    input.type = 'number';
    input.name = name;
    input.min = String(min);
    input.max = String(max);
    input.step = '1';
    input.value = String(current);
    input.style.cssText = 'width:100%;box-sizing:border-box;padding:5px;border:1px solid #d9dce1;border-radius:6px';
    return input;
}
function renderSettings(parent, settings) {
    const details = el('details');
    details.style.cssText = 'padding:8px 12px;border-bottom:1px solid #eceef1';
    const summary = el('summary', '设置');
    summary.style.cssText = 'cursor:pointer;font-weight:600;color:#374151';
    details.append(summary);
    const form = el('form');
    form.style.cssText = 'display:grid;gap:8px;padding-top:10px';
    form.onsubmit = event => {
        event.preventDefault();
        void saveSettings(form);
    };
    const row = el('div');
    row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px';
    row.append(field('提醒级别', selectControl('notificationLevel', ['C1', 'C2', 'C3'], settings.notificationLevel)), field('每小时最多打断', numberControl('maxInterruptsPerHour', settings.maxInterruptsPerHour, 0, 10)));
    form.append(row);
    const thresholds = el('div');
    thresholds.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px';
    thresholds.append(field('停滞阈值（分钟）', numberControl('longRunThresholdMinutes', settings.longRunThresholdMinutes, 1, 120)), field('相邻事件合并（秒）', numberControl('bundleWindowSeconds', settings.bundleWindowSeconds, 0, 900)));
    form.append(thresholds);
    form.append(field('Subagent 压力', selectControl('subagentPressure', ['relaxed', 'standard', 'strict'], settings.subagentPressure)));
    const quiet = el('fieldset');
    quiet.style.cssText = 'display:grid;gap:6px;border:1px solid #eceef1;border-radius:6px;padding:7px';
    quiet.append(el('legend', '静默时段'));
    const quietToggle = el('input');
    quietToggle.type = 'checkbox';
    quietToggle.name = 'quietEnabled';
    quietToggle.checked = settings.quietHours.enabled;
    const quietLabel = el('label', '启用静默时段');
    quietLabel.prepend(quietToggle);
    quietLabel.style.cssText = 'display:flex;gap:6px;align-items:center;color:#4b5563;font-size:12px';
    quiet.append(quietLabel);
    const quietTimes = el('div');
    quietTimes.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px';
    const start = el('input');
    start.type = 'time';
    start.name = 'quietStart';
    start.value = settings.quietHours.start;
    const end = el('input');
    end.type = 'time';
    end.name = 'quietEnd';
    end.value = settings.quietHours.end;
    quietTimes.append(field('开始', start), field('结束', end));
    quiet.append(quietTimes);
    form.append(quiet);
    const privacy = el('label', '仅使用隐私安全摘要');
    const privacyToggle = el('input');
    privacyToggle.type = 'checkbox';
    privacyToggle.name = 'privacySafeSummary';
    privacyToggle.checked = settings.privacySafeSummary;
    privacy.prepend(privacyToggle);
    privacy.style.cssText = 'display:flex;gap:6px;align-items:center;color:#4b5563;font-size:12px';
    form.append(privacy);
    const save = el('button', '保存设置');
    save.type = 'submit';
    save.style.cssText = 'justify-self:start;padding:5px 9px;border:0;border-radius:6px;background:#1f6feb;color:#fff;cursor:pointer';
    form.append(save);
    details.append(form);
    parent.append(details);
}
async function saveSettings(form) {
    const values = new FormData(form);
    const response = await post('/dsh-deepcanary/settings', {
        notificationLevel: values.get('notificationLevel'),
        maxInterruptsPerHour: Number(values.get('maxInterruptsPerHour')),
        longRunThresholdMinutes: Number(values.get('longRunThresholdMinutes')),
        bundleWindowSeconds: Number(values.get('bundleWindowSeconds')),
        subagentPressure: values.get('subagentPressure'),
        privacySafeSummary: values.get('privacySafeSummary') === 'on',
        quietHours: {
            enabled: values.get('quietEnabled') === 'on',
            start: values.get('quietStart'),
            end: values.get('quietEnd'),
        },
    });
    if (response?.ok)
        await refresh();
}
function render(snapshot) {
    let root = document.getElementById(rootId);
    if (!root) {
        root = el('aside');
        root.id = rootId;
        root.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99999;width:min(410px,calc(100vw - 32px));font:13px/1.4 system-ui,sans-serif;color:#202124;background:#fff;border:1px solid #d9dce1;border-radius:12px;box-shadow:0 10px 32px #0002;overflow:hidden';
        document.body.append(root);
    }
    root.replaceChildren();
    const header = el('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #eceef1';
    const title = el('strong', `DeepCanary · ${snapshot.status.plugin.version}`);
    const indicator = el('span', `${snapshot.status.indicator} · ${snapshot.status.openInbox}`);
    indicator.style.cssText = `color:${snapshot.status.indicator === 'gray' ? '#777' : snapshot.status.indicator === 'yellow' ? '#9a7100' : snapshot.status.indicator === 'orange' ? '#b54b00' : '#b00020'};font-weight:600`;
    header.append(title, indicator);
    root.append(header);
    const controls = el('div');
    controls.style.cssText = 'display:flex;gap:6px;align-items:center;padding:8px 12px;border-bottom:1px solid #eceef1';
    const requestButton = button('启用浏览器通知', () => {
        if ('Notification' in globalThis)
            void Notification.requestPermission();
    });
    requestButton.style.cssText = 'padding:5px 8px;border:1px solid #d9dce1;border-radius:6px;background:#fff;cursor:pointer';
    controls.append(requestButton, el('small', `sessions ${snapshot.status.sessions} · interop ${snapshot.status.capabilities.windowsInterop}`));
    root.append(controls);
    renderSettings(root, snapshot.settings);
    const list = el('div');
    list.style.cssText = 'max-height:430px;overflow:auto;padding:0 12px 10px';
    if (snapshot.inbox.length === 0)
        list.append(el('div', '暂无待处理提醒'));
    for (const item of snapshot.inbox.slice(0, 12)) {
        const card = el('section');
        card.style.cssText = 'padding:10px 0;border-top:1px solid #f0f1f3';
        const reason = item.reasonCodes.length > 1 ? item.reasonCodes.join(' + ') : item.reasonCode;
        card.append(el('div', `${item.level} · ${reason}${item.bundleCount > 1 ? ` · ${item.bundleCount} events` : ''}`), el('div', item.why));
        if (item.suggestedAction) {
            const suggestion = el('small', `建议：${item.suggestedAction}`);
            suggestion.style.color = '#4b5563';
            card.append(suggestion);
        }
        const evidence = el('small', item.evidence.map(value => value.summary).join(' · '));
        evidence.style.color = '#666';
        card.append(evidence);
        const buttons = el('div');
        buttons.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:7px';
        const addAction = (label, value) => {
            const control = button(label, () => { void action(item.id, value); });
            control.style.cssText = 'padding:4px 7px;border:1px solid #d9dce1;border-radius:6px;background:#fff;cursor:pointer;font-size:12px';
            buttons.append(control);
        };
        addAction('已处理', { action: 'acknowledge' });
        addAction('稍后提醒', { action: 'snooze', minutes: 30 });
        addAction('静音', { action: 'mute' });
        addAction('有用', { action: 'feedback', useful: true });
        addAction('不相关', { action: 'feedback', useful: false });
        if (item.sessionId) {
            const jump = button('跳转到 DSH', () => {
                void post('/dsh-deepcanary/action', { id: item.id, action: 'jump' }).then(async (response) => {
                    if (!response?.ok)
                        return;
                    const result = await response.json();
                    if (result.available && result.url)
                        window.location.assign(result.url);
                });
            });
            jump.style.cssText = 'padding:4px 7px;border:0;border-radius:6px;background:#1f6feb;color:#fff;cursor:pointer;font-size:12px';
            buttons.append(jump);
        }
        card.append(buttons);
        list.append(card);
    }
    root.append(list);
}
async function refresh() {
    try {
        const response = await fetch('/dsh-deepcanary/state', { cache: 'no-store' });
        if (!response.ok)
            return;
        const snapshot = await response.json();
        render(snapshot);
        notify(snapshot.inbox);
    }
    catch {
        // The host may be restarting; the next poll will reconcile the panel.
    }
}
void refresh();
window.setInterval(() => { void refresh(); }, 5000);
export {};
//# sourceMappingURL=client.js.map