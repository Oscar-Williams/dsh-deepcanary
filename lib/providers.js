import { createHash } from 'node:crypto';
const approvalPattern = /approval|approve|ask[-_ ]?user|permission|confirm|clarif|question/i;
function shortHash(value) {
    return createHash('sha256').update(value).digest('hex').slice(0, 12);
}
function evidence(type, authority, ref, summary) {
    return { type, authority, ref, summary };
}
function signal(source, kind, session, event, facts, item, data = {}, severityHint, bundleKey) {
    const sessionId = session?.id;
    const eventRef = event?.type ? `${event.type}:${event.seq ?? 'na'}` : kind;
    const id = `${kind.toLowerCase()}-${shortHash(`${sessionId ?? 'host'}:${eventRef}:${event?.time ?? Date.now()}`)}`;
    return {
        schemaVersion: 1,
        id,
        occurredAt: new Date(event?.time ?? Date.now()).toISOString(),
        source,
        kind,
        ...(sessionId ? { sessionId } : {}),
        ...(session?.header?.cwd ? { workspaceId: shortHash(session.header.cwd) } : {}),
        ...(severityHint !== undefined ? { severityHint } : {}),
        evidence: [item],
        dedupeKey: `${kind}:${sessionId ?? 'host'}:${event?.type ?? 'probe'}:${String(data.toolName ?? '')}`,
        ...(bundleKey ? { bundleKey } : {}),
        data: {
            ...data,
            ...(facts ? { activeSubagents: facts.activeSubagents } : {}),
        },
    };
}
function turnEndReason(event) {
    const reason = event.data?.reason;
    if (typeof reason === 'string')
        return reason;
    if (reason !== null && typeof reason === 'object' && 'kind' in reason) {
        const kind = reason.kind;
        return typeof kind === 'string' ? kind : undefined;
    }
    return undefined;
}
export function signalsFromSessionEvent(session, event, facts) {
    const eventType = event.type;
    const data = event.data ?? {};
    const ref = `session-event:${eventType}`;
    const result = [];
    const toolName = typeof data.name === 'string' ? data.name : typeof data.toolName === 'string' ? data.toolName : 'unknown-tool';
    const humanMarker = `${eventType} ${toolName} ${typeof data.kind === 'string' ? data.kind : ''}`;
    const visibilityData = data.userViewing === true || data.dshVisible === true ? { userViewing: true } : {};
    if (eventType === 'turn/end') {
        const reason = turnEndReason(event);
        if (reason === 'completed') {
            const suspicious = data.completionSuspicious === true
                || data.unresolvedApproval === true
                || data.failedAcceptanceProbe === true
                || data.waitingHumanAcceptance === true
                || data.verificationPassed === false;
            if (suspicious) {
                result.push(signal('session', 'COMPLETION_SUSPICIOUS', session, event, facts, evidence('session-event', 'runtime', ref, 'DSH reported completion while a structured acceptance or human-needed condition remained unresolved.'), visibilityData, 2, `${session.id}:completion`));
            }
            else {
                result.push(signal('session', 'TASK_COMPLETED', session, event, facts, evidence('session-event', 'runtime', ref, 'DSH reported a normal turn completion.'), visibilityData, 1));
            }
        }
        else if (reason === 'aborted' || reason === 'interrupted') {
            result.push(signal('session', 'TASK_ABORTED', session, event, facts, evidence('session-event', 'runtime', ref, `DSH reported a ${reason} turn.`), visibilityData, 2, `${session.id}:human-needed`));
        }
        else if (reason === 'blocked') {
            result.push(signal('session', 'HUMAN_QUESTION_PENDING', session, event, facts, evidence('session-event', 'runtime', ref, 'DSH reported a blocked turn that may require human input.'), visibilityData, 2, `${session.id}:human-needed`));
        }
        else if (reason === 'error' || reason === 'max-tokens') {
            result.push(signal('session', 'TASK_FAILED', session, event, facts, evidence('session-event', 'runtime', ref, `DSH reported a terminal turn reason: ${reason}.`), visibilityData, 2, `${session.id}:failure`));
        }
    }
    if ((eventType === 'tool/call' && approvalPattern.test(toolName))
        || approvalPattern.test(eventType)
        || data.humanNeeded === true
        || data.requiresApproval === true) {
        const question = /ask[-_ ]?user|question|clarif|human[-_ ]?input/i.test(humanMarker);
        result.push(signal('tool', question ? 'HUMAN_QUESTION_PENDING' : 'HUMAN_APPROVAL_REQUIRED', session, event, facts, evidence('tool-history', 'runtime', ref, 'A DSH event or tool boundary indicates that human input is required.'), { ...visibilityData, toolName }, 2, `${session.id}:human-needed`));
    }
    const failureCount = facts.sameToolFailures ?? facts.toolFailures;
    if (eventType === 'tool/result' && data.error !== undefined && failureCount >= 3) {
        result.push(signal('tool', 'TOOL_FAILURE_LOOP', session, event, facts, evidence('tool-history', 'derived', ref, 'The same tool has produced repeated structured failures.'), { ...visibilityData, failureCount, toolName: facts.lastToolName ?? toolName }, 2, `${session.id}:tool-failure-loop`));
    }
    const contextMarker = `${eventType} ${typeof data.kind === 'string' ? data.kind : ''}`;
    if (/compaction|context[-_/]?(pressure|overflow)|token[-_/]?limit/i.test(contextMarker)) {
        const pressure = /pressure|overflow|token[-_/]?limit/i.test(contextMarker)
            || ((facts.contextCompactions ?? 0) >= 2 && /compaction/i.test(contextMarker));
        result.push(signal('session', pressure ? 'CONTEXT_PRESSURE' : 'COMPACTION_OCCURRED', session, event, facts, evidence('session-event', 'runtime', ref, 'DSH reported a context lifecycle event.'), visibilityData, pressure ? 2 : 1, `${session.id}:context`));
    }
    if (data.healthy !== true && (data.progress === false || data.meaningfulProgress === false || /no[-_/]?progress|stuck|idle/i.test(eventType))) {
        result.push(signal('session', 'NO_MEANINGFUL_PROGRESS', session, event, facts, evidence('runtime-probe', 'derived', ref, 'The session reported no meaningful progress during an active run.'), visibilityData, 2, `${session.id}:progress`));
    }
    return result;
}
export function signalFromAgentError(payload) {
    const sessionId = payload.agent?.id;
    return signal('agent', 'TASK_FAILED', sessionId ? { id: sessionId } : undefined, undefined, undefined, evidence('runtime-probe', 'runtime', 'agent/error', 'DSH reported an agent error.'), { turn: payload.turn ?? -1, step: payload.step ?? -1 }, 2, sessionId ? `${sessionId}:failure` : 'host:failure');
}
export function signalFromSubagentPressure(activeSubagents, threshold, now = Date.now()) {
    return signal('subagent', 'SUBAGENT_PRESSURE', undefined, { type: 'subagent/active', time: now }, undefined, evidence('subagent-state', 'runtime', `active:${threshold}`, `Active subagent count crossed the configured threshold (${threshold}).`), { activeSubagents, threshold }, threshold >= 24 ? 3 : threshold >= 12 ? 2 : 1, `host:subagent-pressure:${threshold}`);
}
export function signalFromHostProbe(ok, detail, now = Date.now()) {
    if (ok)
        return undefined;
    return signal('host', 'HOST_UNREACHABLE', undefined, { type: 'host/probe', time: now }, undefined, evidence('http-probe', 'host', 'webserver/probe', detail), {}, 3, 'host:unreachable');
}
export function signalFromStall(session, facts, thresholdMs, now = Date.now()) {
    if (now - facts.lastEventAt < thresholdMs)
        return undefined;
    return signal('host', 'HOST_SUSPECTED_STALL', session, { type: 'host/stall', time: now }, facts, evidence('runtime-probe', 'runtime', 'session/heartbeat', 'No new DSH session event arrived within the configured liveness window.'), { idleMs: now - facts.lastEventAt }, 2, `${session.id}:stall`);
}
export function signalFromStallRecovery(session, now = Date.now()) {
    return signal('host', 'HOST_STALL_RECOVERED', session, { type: 'host/recovered', time: now }, undefined, evidence('runtime-probe', 'runtime', 'session/heartbeat', 'A new DSH session event arrived after a suspected stall.'), {}, 1);
}
export function signalFromHostRecovery(now = Date.now()) {
    return signal('host', 'HOST_STALL_RECOVERED', undefined, { type: 'host/recovered', time: now }, undefined, evidence('http-probe', 'host', 'webserver/probe', 'The local DSH WebServer responded after a failed probe.'), {}, 1);
}
//# sourceMappingURL=providers.js.map