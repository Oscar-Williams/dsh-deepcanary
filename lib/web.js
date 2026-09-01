import { ATTENTION_PROTOCOL_VERSION, OUTCOME_RECEIPT_SCHEMA_VERSION } from './types.js';
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
function sourceParam(value) {
    if (value === null)
        return undefined;
    if (value === 'real' || value === 'controlled' || value === 'replay')
        return value;
    throw new TypeError('source must be real, controlled, or replay');
}
function outcomeListHandler(req, res, service) {
    if (req.method === 'DELETE') {
        void outcomeDeleteHandler(req, res, service);
        return;
    }
    if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'GET required', schemaVersion: ATTENTION_PROTOCOL_VERSION });
        return;
    }
    try {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1');
        const limit = url.searchParams.get('limit');
        const parsedLimit = limit === null ? 100 : Number(limit);
        if (!Number.isFinite(parsedLimit) || parsedLimit < 1)
            throw new TypeError('limit must be a positive number');
        const trialId = url.searchParams.get('trialId') ?? undefined;
        if (trialId !== undefined && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(trialId))
            throw new TypeError('trialId has an invalid format');
        const source = sourceParam(url.searchParams.get('source'));
        const receipts = service.outcomes(parsedLimit, source, trialId);
        sendJson(res, 200, {
            schemaVersion: ATTENTION_PROTOCOL_VERSION,
            outcomeSchemaVersion: OUTCOME_RECEIPT_SCHEMA_VERSION,
            count: receipts.length,
            receipts,
        });
    }
    catch (error) {
        sendJson(res, 400, { error: error instanceof Error ? error.message : 'invalid outcome query', schemaVersion: ATTENTION_PROTOCOL_VERSION });
    }
}
async function outcomeDeleteHandler(req, res, service) {
    try {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1');
        const trialId = url.searchParams.get('trialId') ?? undefined;
        if (trialId !== undefined && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(trialId))
            throw new TypeError('trialId has an invalid format');
        const source = sourceParam(url.searchParams.get('source'));
        const before = url.searchParams.get('before') ?? undefined;
        const removed = await service.deleteOutcomes({
            ...(source === undefined ? {} : { source }),
            ...(trialId === undefined ? {} : { trialId }),
            ...(before === undefined ? {} : { before }),
        });
        sendJson(res, 200, {
            schemaVersion: ATTENTION_PROTOCOL_VERSION,
            outcomeSchemaVersion: OUTCOME_RECEIPT_SCHEMA_VERSION,
            removed,
            remaining: service.outcomes(2_000).length,
        });
    }
    catch (error) {
        sendJson(res, 400, {
            error: error instanceof Error ? error.message : 'invalid outcome deletion',
            schemaVersion: ATTENTION_PROTOCOL_VERSION,
            outcomeSchemaVersion: OUTCOME_RECEIPT_SCHEMA_VERSION,
        });
    }
}
async function outcomeRecordHandler(req, res, service) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'POST required', schemaVersion: ATTENTION_PROTOCOL_VERSION });
        return;
    }
    try {
        const payload = JSON.parse(await readBody(req));
        const id = typeof payload.id === 'string' ? payload.id : '';
        const input = { ...payload };
        delete input.id;
        const receipt = await service.recordOutcome(id, input);
        if (receipt === undefined) {
            sendJson(res, 404, { id, found: false, schemaVersion: ATTENTION_PROTOCOL_VERSION, outcomeSchemaVersion: OUTCOME_RECEIPT_SCHEMA_VERSION });
            return;
        }
        sendJson(res, 200, { schemaVersion: ATTENTION_PROTOCOL_VERSION, outcomeSchemaVersion: OUTCOME_RECEIPT_SCHEMA_VERSION, receipt });
    }
    catch (error) {
        sendJson(res, 400, { error: error instanceof Error ? error.message : 'invalid outcome payload', schemaVersion: ATTENTION_PROTOCOL_VERSION });
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
            server.register({ kind: 'exact', path: `${basePath}/outcomes`, handler: (req, res) => outcomeListHandler(req, res, service) }),
            server.register({ kind: 'exact', path: `${basePath}/outcome`, handler: (req, res) => outcomeRecordHandler(req, res, service) }),
        ];
        webCtx.on?.('dispose', () => { for (const dispose of disposers)
            dispose(); });
    });
}
//# sourceMappingURL=web.js.map