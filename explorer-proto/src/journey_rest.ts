// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

import {deepEqual, readPath, resolveDeep, resolveTemplate} from './journey_charter.ts';
import type {Bindings, JourneyCharter} from './journey_charter.ts';
import {actorClient, SetupFailure} from './journey_fixture.ts';
import type {Fixture} from './journey_fixture.ts';

type Json = Record<string, unknown>;

export type ClauseResult = {desc: string; ok: boolean};
export type CheckpointResult = {
    id: string;
    ok: boolean;
    clauses: ClauseResult[];
};

const getPath = readPath;

/** Executes one literal charter REST path (templates resolved) with the given bearer token. */
export async function restRequest(
    client: Client4,
    request: string,
    bindings: Bindings,
): Promise<{status: number; json: Json}> {
    const m = /^(GET|POST|PUT|DELETE)\s+(\S+)/.exec(request.trim());
    if (!m) {
        throw new Error(`Unparseable REST request: ${request}`);
    }
    const method = m[1];
    const rawPath = m[2].replace(/[.,;]+$/, '');
    const path = resolveTemplate(rawPath, bindings);
    const url = `${client.getUrl()}${path}`;
    const res = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${client.getToken()}`,
            'X-Requested-With': 'XMLHttpRequest',
        },
    });
    let json: Json = {};
    try {
        json = (await res.json()) as Json;
    } catch {
        json = {};
    }
    return {status: res.status, json};
}

/** Which client a checkpoint polls with: a named actor's own session when it says so, else admin. */
function clientForCheckpoint(cp: Record<string, unknown>, fx: Fixture, pw: PlaywrightExtended): Promise<Client4> {
    const text = JSON.stringify(cp);
    const viewer = Object.keys(fx.bindings.actor).find((id) => text.toLowerCase().includes('own rest session'));
    if (viewer) {
        // The charter spells the actor by name in prose; the only own-session reader here is the UI actor.
        const uiActor = Object.keys(fx.bindings.actor).find((id) => text.toLowerCase().includes(id.toLowerCase()));
        return actorClient(pw, fx, uiActor ?? viewer);
    }
    return Promise.resolve(fx.adminClient);
}

function noMention(charter: JourneyCharter, bindings: Bindings): boolean {
    const strings = Object.values(charter.fixture.fixed_strings ?? {});
    const uiActor = (charter.fixture.actors ?? []).find((a) => a.ui);
    const username = uiActor ? bindings.actor[uiActor.id].username : '';
    const firstName = uiActor?.first_name ?? '';
    return strings.every(
        (s) => !s.includes('@') && !(username && s.includes(username)) && !(firstName && s.includes(firstName)),
    );
}

async function evalClause(
    charter: JourneyCharter,
    clause: Record<string, unknown>,
    bindings: Bindings,
    client: Client4,
): Promise<ClauseResult> {
    if ('no_mention' in clause) {
        return {desc: 'no_mention', ok: noMention(charter, bindings)};
    }
    const request = clause.request as string;
    const {json} = await restRequest(client, request, bindings);

    if ('field' in clause) {
        const field = clause.field as string;
        let value = getPath(json, field);
        if (value === undefined && 'absent_counts_as' in clause) {
            value = clause.absent_counts_as;
        }
        if ('equals' in clause) {
            return {
                desc: `${field} == ${JSON.stringify(clause.equals)}`,
                ok: value === clause.equals,
            };
        }
        if ('not_equals' in clause) {
            return {
                desc: `${field} != ${JSON.stringify(clause.not_equals)}`,
                ok: value !== clause.not_equals,
            };
        }
    }
    if ('expect' in clause) {
        const expect = clause.expect as Record<string, unknown>;
        let ok = true;
        const parts: string[] = [];
        for (const [key, expected] of Object.entries(expect)) {
            let actual: unknown;
            if (key === 'order_length') {
                actual = Array.isArray(json.order) ? (json.order as unknown[]).length : undefined;
            } else {
                actual = getPath(json, key);
            }
            const resolvedExpected = typeof expected === 'string' ? resolveTemplate(expected, bindings) : expected;
            const clauseOk =
                resolvedExpected !== null && typeof resolvedExpected === 'object'
                    ? deepEqual(actual, resolveDeep(resolvedExpected, bindings))
                    : actual === resolvedExpected;
            ok = ok && clauseOk;
            parts.push(`${key}${clauseOk ? '=ok' : '=MISS'}`);
        }
        return {desc: `expect {${parts.join(', ')}}`, ok};
    }
    return {desc: JSON.stringify(clause), ok: false};
}

/** Evaluates a FINAL-style predicate with threads[]/thread[id=..] matchers. */
async function evalFinal(
    predicate: Record<string, unknown>,
    bindings: Bindings,
    client: Client4,
): Promise<ClauseResult[]> {
    const {json} = await restRequest(client, predicate.request as string, bindings);
    const threads = (json.threads as Array<Record<string, unknown>>) ?? [];
    const expect = predicate.expect as Record<string, unknown>;
    const out: ClauseResult[] = [];
    for (const [key, expected] of Object.entries(expect)) {
        if (key === 'threads[].id') {
            const contains = resolveTemplate((expected as {contains: string}).contains, bindings);
            out.push({
                desc: `threads[].id contains ${contains}`,
                ok: threads.some((t) => t.id === contains),
            });
            continue;
        }
        const m = /^thread\[id=(.+?)\]\.(.+)$/.exec(key);
        if (m) {
            const id = resolveTemplate(`{${m[1].replace(/[{}]/g, '')}}`, bindings);
            const thread = threads.find((t) => t.id === id);
            const actual = thread ? getPath(thread, m[2]) : undefined;
            const resolvedExpected = typeof expected === 'string' ? resolveTemplate(expected, bindings) : expected;
            out.push({
                desc: `${key} == ${JSON.stringify(resolvedExpected)}`,
                ok: actual === resolvedExpected,
            });
            continue;
        }
        out.push({desc: `unhandled ${key}`, ok: false});
    }
    return out;
}

/** Evaluates a REST checkpoint (C1/C2/FINAL-style) and returns per-clause results. */
export async function evalRestCheckpoint(
    pw: PlaywrightExtended,
    charter: JourneyCharter,
    cp: Record<string, unknown> & {id: string},
    fx: Fixture,
): Promise<CheckpointResult> {
    const client = await clientForCheckpoint(cp, fx, pw);
    const predicate = cp.predicate as Record<string, unknown>;
    // A clause whose template is not bound yet (e.g. it names an event id before the event fired)
    // counts as not-yet-true, never as an error.
    const guarded = async (fn: () => Promise<ClauseResult>): Promise<ClauseResult> => {
        try {
            return await fn();
        } catch (error) {
            if (error instanceof Error && /Unbound charter template/.test(error.message)) {
                return {
                    desc: 'not evaluable yet (dependency unbound)',
                    ok: false,
                };
            }
            throw error;
        }
    };

    let clauses: ClauseResult[];
    if (Array.isArray(predicate.all)) {
        clauses = [];
        for (const clause of predicate.all as Array<Record<string, unknown>>) {
            clauses.push(await guarded(() => evalClause(charter, clause, fx.bindings, client)));
        }
    } else if (
        'threads[].id' in ((predicate.expect as Record<string, unknown>) ?? {}) ||
        /users\/.*\/threads/.test(String(predicate.request ?? ''))
    ) {
        try {
            clauses = await evalFinal(predicate, fx.bindings, client);
        } catch (error) {
            if (error instanceof Error && /Unbound charter template/.test(error.message)) {
                clauses = [
                    {
                        desc: 'not evaluable yet (dependency unbound)',
                        ok: false,
                    },
                ];
            } else {
                throw error;
            }
        }
    } else {
        clauses = [await guarded(() => evalClause(charter, predicate, fx.bindings, client))];
    }
    return {id: cp.id, ok: clauses.every((c) => c.ok), clauses};
}

export type FiredEvent = {id: string; bound: Record<string, string>};

/** Fires a charter event (post_thread): the actor's own client posts root then reply; binds the ids. */
export async function fireEvent(
    pw: PlaywrightExtended,
    charter: JourneyCharter,
    event: Record<string, unknown> & {id: string},
    fx: Fixture,
): Promise<FiredEvent> {
    if (event.action !== 'post_thread') {
        throw new SetupFailure(`unsupported event action ${String(event.action)}`);
    }
    const params = event.params as {
        channel: string;
        root: string;
        reply: string;
    };
    const channelId = fx.bindings.channel[params.channel].id;
    const client = await actorClient(pw, fx, event.actor as string);
    const rootMessage = resolveTemplate(params.root, fx.bindings);
    const replyMessage = resolveTemplate(params.reply, fx.bindings);

    const root = await client.createPost({
        channel_id: channelId,
        message: rootMessage,
    } as never);
    const reply = await client.createPost({
        channel_id: channelId,
        message: replyMessage,
        root_id: root.id,
    } as never);

    const bound = {root_id: root.id, reply_id: reply.id};
    fx.bindings.event[event.id] = bound;
    return {id: event.id, bound};
}
