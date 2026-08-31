import { ATTENTION_PROTOCOL_VERSION } from './types.js';
const basePath = '/dsh-deepcanary';
function sendJson(res, status, value, headers = {}) {
    const body = JSON.stringify(value);
    res.statusCode = status;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    for (const [name, value] of Object.entries(headers))
        res.setHeader(name, value);
    res.end(body);
}
function sendNotModified(res, etag) {
    res.statusCode = 304;
    res.setHeader('cache-control', 'no-store');
    res.setHeader('etag', etag);
    res.end();
}
function etagFor(revision) {
    return `W/"dc-${revision}"`;
}
function readBody(req) {
    return new Promise((resolve, reject) => {
        let value = '';
        req.setEncoding('utf8');
        req.on('data', chunk => {
            value += chunk;
            if (value.length > 32_000)
                reject(new Error('request body too large'));
        });
        req.on('end', () => resolve(value));
        req.on('error', reject);
    });
}
async function actionHandler(req, res, service) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'POST required' });
        return;
    }
    try {
        const payload = JSON.parse(await readBody(req));
        const id = typeof payload.id === 'string' ? payload.id : '';
        const action = typeof payload.action === 'string' ? payload.action : '';
        const requestId = typeof payload.requestId === 'string' ? payload.requestId : '';
        const receipt = await service.performAction(requestId, id, action, payload);
        sendJson(res, receipt.status, receipt.body);
    }
    catch {
        sendJson(res, 400, { error: 'invalid action payload', schemaVersion: ATTENTION_PROTOCOL_VERSION });
    }
}
function explainHandler(req, res, service) {
    if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'GET required', schemaVersion: ATTENTION_PROTOCOL_VERSION });
        return;
    }
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const id = url.searchParams.get('id') ?? '';
    const explanation = service.explain(id);
    if (explanation === undefined)
        sendJson(res, 404, { id, found: false, schemaVersion: ATTENTION_PROTOCOL_VERSION });
    else
        sendJson(res, 200, explanation);
}
async function dryRunHandler(req, res, service) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'POST required', schemaVersion: ATTENTION_PROTOCOL_VERSION });
        return;
    }
    try {
        const payload = JSON.parse(await readBody(req));
        const result = await service.dryRun(payload);
        sendJson(res, 200, result);
    }
    catch (error) {
        sendJson(res, 400, { error: error instanceof Error ? error.message : 'invalid dry-run payload', schemaVersion: ATTENTION_PROTOCOL_VERSION });
    }
}
export function installWebRoutes(ctx, service) {
    const context = ctx;
    context.inject?.(['webServer'], (webCtx) => {
        const server = webCtx.webServer;
        if (!server?.register)
            return;
        const disposers = [
            server.register({ kind: 'exact', path: `${basePath}/state`, handler: (req, res) => {
                    if (req.method !== 'GET')
                        sendJson(res, 405, { error: 'GET required' });
                    else {
                        const snapshot = service.snapshot();
                        const etag = etagFor(snapshot.revision);
                        if (req.headers['if-none-match'] === etag)
                            sendNotModified(res, etag);
                        else
                            sendJson(res, 200, snapshot, { etag });
                    }
                } }),
            server.register({ kind: 'exact', path: `${basePath}/settings`, handler: async (req, res) => {
                    if (req.method === 'GET') {
                        sendJson(res, 200, service.settings(), { etag: etagFor(service.status().revision) });
                        return;
                    }
                    if (req.method !== 'POST') {
                        sendJson(res, 405, { error: 'GET or POST required' });
                        return;
                    }
                    try {
                        const payload = JSON.parse(await readBody(req));
                        const settings = await service.updateSettings(payload);
                        sendJson(res, 200, settings, { etag: etagFor(service.status().revision) });
                    }
                    catch (error) {
                        sendJson(res, 400, { error: error instanceof Error ? error.message : 'invalid settings payload' });
                    }
                } }),
            server.register({ kind: 'exact', path: `${basePath}/health`, handler: (req, res) => {
                    if (req.method !== 'GET')
                        sendJson(res, 405, { error: 'GET required' });
                    else {
                        const status = service.status();
                        sendJson(res, 200, { ok: true, schemaVersion: ATTENTION_PROTOCOL_VERSION, revision: status.revision, plugin: status.plugin, sessions: status.sessions, tools: status.tools });
                    }
                } }),
            server.register({ kind: 'exact', path: `${basePath}/action`, handler: (req, res) => actionHandler(req, res, service) }),
            server.register({ kind: 'exact', path: `${basePath}/explain`, handler: (req, res) => explainHandler(req, res, service) }),
            server.register({ kind: 'exact', path: `${basePath}/dry-run`, handler: (req, res) => dryRunHandler(req, res, service) }),
        ];
        webCtx.on?.('dispose', () => { for (const dispose of disposers)
            dispose(); });
    });
}
//# sourceMappingURL=web.js.map