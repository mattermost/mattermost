// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import path from 'node:path';

import * as prettier from 'prettier';

import {readJourneyCharter} from './journey_charter.ts';
import type {JourneyCharter} from './journey_charter.ts';
import {journeySpecLocation, journeySpecStem} from './journey_spec_path.ts';
import {PLAYWRIGHT_DIR, outDir} from './paths.ts';
import type {RoleName} from './snapshot.ts';

export type JourneyEmission = {
    status: 'emitted' | 'stopped';
    file?: string;
    reasons: string[];
    steps: string[];
};

class Stop extends Error {}
function stop(message: string): never {
    throw new Stop(message);
}

function q(text: string): string {
    return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

type JourneyTrace = {
    schema: string;
    qualified: {
        path: RoleName[];
        eventStep: Record<string, number>;
        stepPathnames: string[];
        c3SnapshotExposesRowText: boolean | null;
        uiObservations: string[];
    } | null;
    counters: Record<string, number>;
    stopped_reason: string;
};

/** Converts a charter dotted template path (e.g. actor.bea.id) into a spec code expression. */
function codeExpr(dotted: string, names: Names): string {
    let m = /^team\.(name|id)$/.exec(dotted);
    if (m) {
        return `team.${m[1]}`;
    }
    m = /^actor\.([a-z0-9]+)\.(\w+)$/.exec(dotted);
    if (m) {
        return `${m[1]}.${m[2]}`;
    }
    m = /^channel\.([a-z0-9]+)\.(\w+)$/.exec(dotted);
    if (m) {
        return `${m[1]}.${m[2]}`;
    }
    m = /^event\.([A-Za-z0-9]+)\.(\w+)$/.exec(dotted);
    if (m) {
        const varName = names.eventVar[`${m[1]}.${m[2]}`];
        if (!varName) {
            stop(`emitter has no variable for event binding ${dotted}`);
        }
        // The event binds a post's id (root_id/reply_id); the emitted post object is `varName`.
        return `${varName}.id`;
    }
    m = /^fixture\.fixed_strings\.(\w+)$/.exec(dotted);
    if (m) {
        const c = names.fixedStringConst[m[1]];
        if (!c) {
            stop(`emitter has no constant for fixed string ${dotted}`);
        }
        return c;
    }
    return stop(`emitter cannot map template {${dotted}}`);
}

/** Emits a charter expected value: numbers/booleans as literals, strings/templates via jsValue. */
function emitExpected(expected: unknown, names: Names): string {
    if (typeof expected === 'number' || typeof expected === 'boolean') {
        return String(expected);
    }
    return jsValue(String(expected), names);
}

/** Converts a charter string that may contain {templates} into a TS expression (literal, var, or template). */
function jsValue(text: string, names: Names): string {
    if (!/\{[a-zA-Z0-9_.]+\}/.test(text)) {
        return q(text);
    }
    const whole = /^\{([a-zA-Z0-9_.]+)\}$/.exec(text);
    if (whole) {
        return codeExpr(whole[1], names);
    }
    const body = text
        .replace(/\{([a-zA-Z0-9_.]+)\}/g, (_, k: string) => `\${${codeExpr(k, names)}}`)
        .replace(/`/g, '\\`');
    return `\`${body}\``;
}

type Names = {
    eventVar: Record<string, string>; // "E1.root_id" -> "root"
    fixedStringConst: Record<string, string>; // "root" -> "ROOT"
};

function buildNames(charter: JourneyCharter): Names {
    const eventVar: Record<string, string> = {};
    for (const event of charter.events) {
        for (const req of (event.requests as string[]) ?? []) {
            const m = /store id as event\.([A-Za-z0-9]+)\.(\w+)/.exec(req);
            if (m) {
                const field = m[2];
                eventVar[`${m[1]}.${field}`] = field.replace(/_id$/, '');
            }
        }
    }
    const fixedStringConst: Record<string, string> = {};
    for (const key of Object.keys(charter.fixture.fixed_strings ?? {})) {
        fixedStringConst[key] = key.toUpperCase();
    }
    return {eventVar, fixedStringConst};
}

/** Picks the Client4 call for one charter REST request path. Supports the v1 journey path shapes only. */
function restCall(request: string, names: Names, clientVar: string): {call: string} {
    const pathPart = /^(?:GET|POST|PUT|DELETE)\s+(\S+)/.exec(request.trim())?.[1]?.replace(/[.,;]+$/, '') ?? '';
    let m = /^\/api\/v4\/channels\/\{([^}]+)\}\/members\/\{([^}]+)\}$/.exec(pathPart);
    if (m) {
        return {
            call: `${clientVar}.getChannelMember(${codeExpr(m[1], names)}, ${codeExpr(m[2], names)})`,
        };
    }
    m = /^\/api\/v4\/posts\/\{([^}]+)\}\/thread$/.exec(pathPart);
    if (m) {
        return {call: `${clientVar}.getPostThread(${codeExpr(m[1], names)})`};
    }
    m = /^\/api\/v4\/posts\/\{([^}]+)\}$/.exec(pathPart);
    if (m) {
        return {call: `${clientVar}.getPost(${codeExpr(m[1], names)})`};
    }
    m = /^\/api\/v4\/users\/\{([^}]+)\}\/teams\/\{([^}]+)\}\/threads$/.exec(pathPart);
    if (m) {
        return {
            call: `${clientVar}.getUserThreads(${codeExpr(m[1], names)}, ${codeExpr(m[2], names)}, {})`,
        };
    }
    return stop(`emitter does not support REST request shape: ${pathPart}`);
}

function clientForCheckpoint(cp: Record<string, unknown>): string {
    return JSON.stringify(cp).toLowerCase().includes('own rest session') ? 'beaClient' : 'adminClient';
}

/** Generates assertions for a REST checkpoint from the charter predicate, labelled with its id. */
function restCheckpointCode(cp: Record<string, unknown> & {id: string}, names: Names): string[] {
    const tag = ` // declared (charter ${cp.id})`;
    const clientVar = clientForCheckpoint(cp);
    const predicate = cp.predicate as Record<string, unknown>;
    const lines: string[] = [`// Checkpoint ${cp.id} (REST): ${String(cp.description ?? '')}`];
    let restVar = 0;

    const clauses = Array.isArray(predicate.all) ? (predicate.all as Array<Record<string, unknown>>) : [predicate];
    for (const clause of clauses) {
        if ('no_mention' in clause) {
            for (const key of Object.keys(names.fixedStringConst)) {
                const c = names.fixedStringConst[key];
                lines.push(`expect(${c}.includes('@')).toBe(false);${tag}`);
                lines.push(`expect(${c}.includes(bea.username)).toBe(false);${tag}`);
                lines.push(`expect(${c}.includes('Bea')).toBe(false);${tag}`);
            }
            continue;
        }
        const call = restCall(clause.request as string, names, clientVar).call;
        if ('field' in clause) {
            const field = (clause.field as string)
                .split('.')
                .map((p) => `?.${p}`)
                .join('');
            if ('equals' in clause) {
                lines.push(
                    `await expect.poll(() => ${call}.then((m) => m${field})).toBe(${jsValue(String(clause.equals), names)});${tag}`,
                );
            } else if ('not_equals' in clause) {
                const fallback =
                    'absent_counts_as' in clause ? ` ?? ${jsValue(String(clause.absent_counts_as), names)}` : '';
                lines.push(
                    `await expect.poll(() => ${call}.then((m) => (m${field}${fallback}))).not.toBe(${jsValue(String(clause.not_equals), names)});${tag}`,
                );
            }
            continue;
        }
        if ('expect' in clause) {
            const expect = clause.expect as Record<string, unknown>;
            restVar++;
            const v = `fetched${restVar}`;
            lines.push(`const ${v} = await ${call};${tag}`);
            for (const [key, expected] of Object.entries(expect)) {
                if (key === 'order_length') {
                    lines.push(`expect(${v}.order.length).toBe(${Number(expected)});${tag}`);
                } else {
                    lines.push(`expect(${v}.${key}).toBe(${emitExpected(expected, names)});${tag}`);
                }
            }
            continue;
        }
        stop(`emitter cannot translate REST clause for ${cp.id}: ${JSON.stringify(clause)}`);
    }
    return lines;
}

/** Generates assertions for FINAL-style predicate with threads[]/thread[id=..] matchers. */
function finalCheckpointCode(cp: Record<string, unknown> & {id: string}, names: Names): string[] {
    const tag = ` // declared (charter ${cp.id})`;
    const predicate = cp.predicate as Record<string, unknown>;
    const call = restCall(predicate.request as string, names, clientForCheckpoint(cp)).call;
    const expect = predicate.expect as Record<string, unknown>;
    const lines: string[] = [
        `// Checkpoint ${cp.id} (REST, independent of the UI): ${String(cp.description ?? '')}`,
        `const list = await ${call};${tag}`,
    ];
    let declaredMatched = false;
    for (const [key, expected] of Object.entries(expect)) {
        if (key === 'threads[].id') {
            const contains = codeExpr((expected as {contains: string}).contains.replace(/[{}]/g, ''), names);
            lines.push(`expect(list.threads.map((t) => t.id)).toContain(${contains});${tag}`);
            continue;
        }
        const m = /^thread\[id=\{?([^}\]]+)\}?\]\.(.+)$/.exec(key);
        if (m) {
            const id = codeExpr(m[1], names);
            if (!declaredMatched) {
                lines.push(`const matched = list.threads.find((t) => t.id === ${id});${tag}`);
                lines.push(`expect(matched).toBeTruthy();${tag}`);
                declaredMatched = true;
            }
            lines.push(`expect(matched?.${m[2]}).toBe(${emitExpected(expected, names)});${tag}`);
            continue;
        }
        stop(`emitter cannot translate FINAL key ${key}`);
    }
    return lines;
}

/** Generates assertions for a UI checkpoint from the charter snapshot predicate. */
function uiCheckpointCode(cp: Record<string, unknown> & {id: string}, charter: JourneyCharter, names: Names): string[] {
    const tag = ` // declared (charter ${cp.id})`;
    const predicate = cp.predicate as Record<string, unknown>;
    const lines: string[] = [`// Checkpoint ${cp.id} (UI): ${String(cp.description ?? '')}`];

    if (typeof predicate.url_path_matches === 'string') {
        const body = predicate.url_path_matches.replace(
            /\{([a-zA-Z0-9_.]+)\}/g,
            (_, k: string) => `\${${codeExpr(k, names)}}`,
        );
        lines.push(`await expect(page).toHaveURL((u) => new RegExp(\`${body}\`).test(u.pathname));${tag}`);
    }
    if (typeof predicate.url_path_equals === 'string') {
        lines.push(
            `await expect(page).toHaveURL((u) => u.pathname === ${jsValue(predicate.url_path_equals, names)});${tag}`,
        );
    }

    const snapshot = predicate.snapshot as {all?: Array<Record<string, unknown>>} | undefined;
    for (const clause of snapshot?.all ?? []) {
        if ('role' in clause && 'contains' in clause) {
            if (charter.events.length && cp.id === 'C3' && readQualified(charter).c3SnapshotExposesRowText === false) {
                stop(
                    `${cp.id}: the aria snapshot does not expose the row's child text under the aria-labelled link; refusing to weaken the predicate`,
                );
            }
            const containerRole = clause.role as string;
            const inner = clause.contains as Record<string, unknown>;
            const innerName = jsValue(inner.name as string, names);
            const container = `page.getByRole(${q(containerRole)})`;
            const link = `${container}.getByRole(${q(inner.role as string)}, {name: ${innerName}, exact: true})`;
            lines.push(`await expect(${link}).toHaveCount(${Number(inner.count)});${tag}`);
            if (inner.subtree_text_contains) {
                lines.push(
                    `await expect(${link}).toContainText(${jsValue(inner.subtree_text_contains as string, names)});${tag}`,
                );
            }
            continue;
        }
        if ('role' in clause) {
            const role = clause.role as string;
            const opts: string[] = [];
            if (clause.name) {
                opts.push(`name: ${jsValue(clause.name as string, names)}, exact: true`);
            }
            if (clause.name_contains) {
                opts.push(`name: /${clause.name_contains as string}/`);
            }
            if (clause.level !== undefined) {
                opts.push(`level: ${Number(clause.level)}`);
            }
            const locator = `page.getByRole(${q(role)}${opts.length ? `, {${opts.join(', ')}}` : ''})`;
            if (clause.selected === true) {
                lines.push(`await expect(${locator}).toHaveAttribute('aria-selected', 'true');${tag}`);
            }
            if (clause.count !== undefined) {
                lines.push(`await expect(${locator}).toHaveCount(${Number(clause.count)});${tag}`);
            } else if (clause.count_at_least !== undefined) {
                lines.push(
                    `expect(await ${locator}.count()).toBeGreaterThanOrEqual(${Number(clause.count_at_least)});${tag}`,
                );
            }
            continue;
        }
        if ('text' in clause) {
            lines.push(
                `await expect(page.getByText(${jsValue(clause.text as string, names)}, {exact: true})).toHaveCount(${Number(clause.count)});${tag}`,
            );
            continue;
        }
        if ('text_contains' in clause) {
            lines.push(
                `await expect(page.getByText(${jsValue(clause.text_contains as string, names)}).first()).toBeVisible();${tag}`,
            );
            continue;
        }
        stop(`emitter cannot translate UI clause for ${cp.id}: ${JSON.stringify(clause)}`);
    }
    return lines;
}

function actionClick(action: RoleName, traceN: number): string {
    return [
        `// discovered action (trace #${traceN})`,
        `await page.getByRole(${q(action.role)}, {name: ${q(action.name)}, exact: true}).click();`,
    ].join('\n        ');
}

let qualifiedCache: JourneyTrace['qualified'] | null | undefined;
function readQualified(charter: JourneyCharter): NonNullable<JourneyTrace['qualified']> {
    void charter;
    if (!qualifiedCache) {
        stop('no qualified path in the trace');
    }
    return qualifiedCache;
}

function fixtureCode(charter: JourneyCharter, names: Names): string[] {
    const f = charter.fixture;
    const lines: string[] = [];
    lines.push('const slug = pw.random.id();');
    lines.push('const password = pw.newTestPassword();');
    lines.push('const {adminClient, adminUser} = await pw.getAdminClient();');
    lines.push("if (!adminUser) { throw new Error('admin client is required'); }");
    lines.push('');
    lines.push('// Server preconditions (read-only GET /config; never patched).');
    lines.push('const config = await adminClient.getConfig();');
    for (const [key, expected] of Object.entries(f.server_preconditions?.expect ?? {})) {
        if (typeof expected === 'string' && expected.includes(' or ')) {
            const allowed = expected.split(' or ').map((s) => q(s.trim()));
            lines.push(`expect([${allowed.join(', ')}], 'precondition ${key}').toContain(config.${key});`);
        } else {
            lines.push(`expect(config.${key}, 'precondition ${key}').toBe(${JSON.stringify(expected)});`);
        }
    }
    lines.push('');
    lines.push(
        `const team = await adminClient.createTeam({name: \`team-\${slug}\`, display_name: \`Team \${slug}\`, type: 'O'});`,
    );
    for (const actor of f.actors ?? []) {
        const v = actor.id;
        const username = (actor.username_template ?? '').replace('{slug}', '${slug}');
        const email = (actor.email_template ?? '').replace('{slug}', '${slug}');
        lines.push(
            `const ${v} = await adminClient.createUser({username: \`${username}\`, email: \`${email}\`, password, first_name: ${q(actor.first_name ?? '')}, last_name: ${q(actor.last_name ?? '')}} as never, '', '');`,
        );
        if (actor.team_member) {
            lines.push(`await adminClient.addToTeam(team.id, ${v}.id);`);
        }
    }
    for (const ch of f.channels ?? []) {
        const key = ch.key as string;
        const name = (ch.name_template as string).replace('{slug}', '${slug}');
        lines.push(
            `const ${key} = await adminClient.createChannel({team_id: team.id, name: \`${name}\`, display_name: ${q(ch.display_name as string)}, type: ${q((ch.api_type as string) ?? 'O')}});`,
        );
        for (const memberId of (ch.members as string[]) ?? []) {
            lines.push(`await adminClient.addToChannel(${memberId}.id, ${key}.id);`);
        }
    }
    lines.push('');
    for (const actor of f.actors ?? []) {
        lines.push(
            `const {client: ${actor.id}Client} = await pw.makeClient({username: ${actor.id}.username, password});`,
        );
    }
    lines.push('');
    // Preferences, grouped by actor.
    const byActor = new Map<string, string[]>();
    for (const pref of f.preferences ?? []) {
        const actorId = pref.actor as string;
        const nameExpr = /^\{[^}]+\}$/.test(pref.name as string)
            ? codeExpr((pref.name as string).replace(/[{}]/g, ''), names)
            : q(pref.name as string);
        const entry = `{user_id: ${actorId}.id, category: ${q(pref.category as string)}, name: ${nameExpr}, value: ${q(pref.value as string)}}`;
        const list = byActor.get(actorId) ?? [];
        list.push(entry);
        byActor.set(actorId, list);
    }
    for (const [actorId, entries] of byActor) {
        lines.push(
            `await ${actorId}Client.savePreferences(${actorId}.id, [\n            ${entries.join(',\n            ')},\n        ]);`,
        );
    }
    lines.push('');
    // viewed_last: the UI actor (charter.start.actor) views its channels, first-declared last.
    const viewer = (f.actors ?? []).find((a) => a.id === charter.start.actor);
    if (viewer) {
        const viewerChannels = (f.channels ?? [])
            .filter((c) => ((c.members as string[]) ?? []).includes(viewer.id))
            .map((c) => c.key as string)
            .reverse();
        for (const key of viewerChannels) {
            lines.push(`await ${viewer.id}Client.viewMyChannel(${key}.id);`);
        }
    }
    lines.push('');
    lines.push('// Read-backs: any mismatch is a setup failure, not a product finding.');
    if (viewer) {
        for (const ch of f.channels ?? []) {
            if (((ch.members as string[]) ?? []).includes(viewer.id)) {
                lines.push(
                    `expect((await adminClient.getChannelMember(${ch.key}.id, ${viewer.id}.id)).notify_props?.channel_auto_follow_threads ?? 'off').not.toBe('on');`,
                );
            }
        }
        lines.push(
            `expect((await ${viewer.id}Client.getUserThreads(${viewer.id}.id, team.id, {})).threads?.length ?? 0).toBe(0);`,
        );
    }
    return lines;
}

export async function emitJourney(journey: string): Promise<JourneyEmission> {
    const charter = readJourneyCharter(journey);
    const dir = outDir();
    const tracePath = path.join(dir, 'trace.json');
    if (!fs.existsSync(tracePath)) {
        return {
            status: 'stopped',
            reasons: [`no trace.json in ${dir}; run explore --journey=${journey} first`],
            steps: [],
        };
    }
    const trace = JSON.parse(fs.readFileSync(tracePath, 'utf-8')) as JourneyTrace;
    qualifiedCache = trace.qualified;

    const location = journeySpecLocation(journey);
    try {
        if (charter.success_criteria.outcomes) {
            stop(
                'the charter declares success_criteria.outcomes: its deliverable is the verdict in report.json; spec emission from an outcome run is not implemented, so no spec is written.',
            );
        }
        if (!trace.qualified) {
            stop(
                `the runner did not discover a complete journey within budget (${JSON.stringify(trace.counters)}); stopped because: ${trace.stopped_reason}. No spec is written; the report is the deliverable.`,
            );
        }
        const names = buildNames(charter);
        const qualified = trace.qualified;
        const path_ = qualified.path;
        const event = charter.events[0];
        const eventStep = qualified.eventStep[event.id];
        if (eventStep === undefined) {
            stop('the qualifying path has no recorded event trigger point');
        }

        const preActions = path_.slice(0, eventStep);
        const postActions = path_.slice(eventStep);

        // Checkpoints by id.
        const cp = (id: string) => charter.checkpoints.find((c) => c.id === id);
        for (const id of (charter.success_criteria.qualifies_when.match(/[A-Z][A-Z0-9]*/g) ?? []).filter((x) =>
            charter.checkpoints.some((c) => c.id === x),
        )) {
            if (!cp(id)) {
                stop(`declared checkpoint ${id} is missing from the charter`);
            }
        }

        const c1 = cp(
            event.trigger && (event.trigger as {checkpoint: string}).checkpoint
                ? (event.trigger as {checkpoint: string}).checkpoint
                : 'C1',
        )!;
        const c2 = cp((event.result_checkpoint as string) ?? 'C2')!;
        const uiCps = charter.checkpoints.filter((c) => c.kind === 'ui');
        const finalCp = charter.checkpoints.find((c) => c.kind === 'rest' && c.id !== c1.id && c.id !== c2.id)!;

        const body: string[] = [];
        body.push(...fixtureCode(charter, names));
        body.push('');
        body.push('// Sign the UI actor in through the framework and open the charter start path.');
        body.push(`const {page} = await pw.testBrowser.login({...${charter.start.actor}, password});`);
        const startPathExpr = charter.start.start_path.replace(
            /\{([a-zA-Z0-9_.]+)\}/g,
            (_, k: string) => `\${${codeExpr(k, names)}}`,
        );
        body.push(`await page.goto(\`${startPathExpr}\`);`);
        body.push('');
        body.push('// Discovered UI actions up to the preference save (exact role + name from the recorded path).');
        preActions.forEach((a, i) => body.push(actionClick(a, i + 1)));
        body.push('');
        body.push(...restCheckpointCode(c1, names));
        body.push('');
        body.push(
            `// ${event.id}: teammate event posted over REST by ${String(event.actor)}'s client (not through his UI).`,
        );
        const params = event.params as {
            channel: string;
            root: string;
            reply: string;
        };
        const rootVar = names.eventVar[`${event.id}.root_id`];
        const replyVar = names.eventVar[`${event.id}.reply_id`];
        body.push(
            `const ${rootVar} = await ${String(event.actor)}Client.createPost({channel_id: ${params.channel}.id, message: ${names.fixedStringConst['root']}});`,
        );
        body.push(
            `const ${replyVar} = await ${String(event.actor)}Client.createPost({channel_id: ${params.channel}.id, message: ${names.fixedStringConst['reply']}, root_id: ${rootVar}.id});`,
        );
        body.push('');
        body.push(...restCheckpointCode(c2, names));
        body.push('');
        body.push('// Discovered UI actions after the event, with the UI checkpoints at the states they reach.');
        // Place each UI checkpoint right after the action that first reaches its URL.
        const uiByStep = new Map<number, Array<Record<string, unknown> & {id: string}>>();
        for (const u of uiCps) {
            const idx = firstStepMatching(u, qualified.stepPathnames, eventStep);
            if (idx === null) {
                stop(`UI checkpoint ${u.id} url was never reached on the qualifying path`);
            }
            const rel = idx - eventStep; // index within postActions (0 = before first post action)
            const list = uiByStep.get(rel) ?? [];
            list.push(u);
            uiByStep.set(rel, list);
        }
        for (const u of uiByStep.get(0) ?? []) {
            body.push(...uiCheckpointCode(u, charter, names));
        }
        postActions.forEach((a, i) => {
            body.push(actionClick(a, eventStep + i + 1));
            for (const u of uiByStep.get(i + 1) ?? []) {
                body.push(...uiCheckpointCode(u, charter, names));
            }
        });
        body.push('');
        body.push(...finalCheckpointCode(finalCp, names));

        const source = render(charter, journey, body);
        const formatted = await format(source);
        fs.mkdirSync(location.dir, {recursive: true});
        fs.writeFileSync(location.absolute, formatted);

        const rel = path.relative(path.join(PLAYWRIGHT_DIR, '..'), location.absolute);
        return {
            status: 'emitted',
            file: rel,
            reasons: [
                `qualified path has ${path_.length} actions; event fires after action ${eventStep}`,
                `C3 row text exposed by snapshot: ${qualified.c3SnapshotExposesRowText}; UI observation methods: ${qualified.uiObservations.join(', ')}`,
            ],
            steps: path_.map(
                (a, i) => `#${i + 1} ${a.role} "${a.name}"${i === eventStep - 1 ? ' [event fires after this]' : ''}`,
            ),
        };
    } catch (error) {
        if (error instanceof Stop) {
            return {
                status: 'stopped',
                reasons: [`STOP: ${error.message}`],
                steps: [],
            };
        }
        throw error;
    }
}

/** First path step (>= eventStep, i.e. after the event) whose sanitized pathname matches the checkpoint url. */
function firstStepMatching(
    u: Record<string, unknown> & {id: string},
    stepPathnames: string[],
    eventStep: number,
): number | null {
    const predicate = u.predicate as Record<string, unknown>;
    const toSanitized = (tmpl: string) =>
        tmpl
            .replace(/\{team\.name\}/g, '<team>')
            .replace(/\{event\.[A-Za-z0-9]+\.\w+\}/g, '<id>')
            .replace(/\{channel\.[a-z0-9]+\.\w+\}/g, '<id>');
    let test: (p: string) => boolean;
    if (typeof predicate.url_path_equals === 'string') {
        const want = toSanitized(predicate.url_path_equals);
        test = (p) => p === want;
    } else if (typeof predicate.url_path_matches === 'string') {
        const re = new RegExp(toSanitized(predicate.url_path_matches));
        test = (p) => re.test(p);
    } else {
        return null;
    }
    for (let i = eventStep; i < stepPathnames.length; i++) {
        if (stepPathnames[i] !== undefined && test(stepPathnames[i])) {
            return i;
        }
    }
    return null;
}

function render(charter: JourneyCharter, journey: string, body: string[]): string {
    const code = body.map((l) => (l ? `        ${l}` : '')).join('\n');
    const objective = wrap(`@objective ${charter.goal}`, 110).map((l) => ` * ${l}`);
    const title = `${journeySpecStem(charter.journey_id)}: ${charter.journey_id}`;
    return `// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Generated by explorer-proto/src/emit_journey.ts from the recorded exploration trace (discovered actions and
// locators) and sessions/${journey}/charter.json (declared fixture, checkpoints and the teammate event). Do not
// edit by hand; re-run explore + emit --journey=${journey}. The teammate's root and reply are posted over REST by
// Abe's own client, never through Abe's UI. This journey is not licence-gated, so pw.skipIfNoLicense() is not used.

import {expect, test} from '@mattermost/playwright-lib';

const ROOT = ${q(charter.fixture.fixed_strings?.root ?? '')};
const REPLY = ${q(charter.fixture.fixed_strings?.reply ?? '')};

/**
${objective.join('\n')}
 *
 * The teammate stimulus (Abe's root and reply) is posted over REST by Abe's own client, not through his UI.
 * Hard expects only.
 */
test(${q(title)}, {tag: ['@channels', '@notifications', '@threads']}, async ({pw}) => {
${code}
});
`;
}

function wrap(text: string, width: number): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
        if (line && line.length + word.length + 1 > width) {
            lines.push(line);
            line = word;
        } else {
            line = line ? `${line} ${word}` : word;
        }
    }
    return line ? [...lines, line] : lines;
}

async function format(source: string): Promise<string> {
    const options = await prettier.resolveConfig(path.join(PLAYWRIGHT_DIR, 'playwright.config.ts'));
    return prettier.format(source, {
        ...(options ?? {}),
        parser: 'typescript',
    });
}
