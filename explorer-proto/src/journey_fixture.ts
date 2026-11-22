// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {UserProfile} from '@mattermost/types/users';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

import {resolveDeep, resolveTemplate} from './journey_charter.ts';
import type {Bindings, JourneyActor, JourneyCharter} from './journey_charter.ts';
import {restRequest} from './journey_rest.ts';

/** A precondition or read-back mismatch: a setup failure, never a product finding. */
export class SetupFailure extends Error {}

export type Fixture = {
    bindings: Bindings;
    slug: string;
    adminClient: Client4;
    actorClients: Record<string, Client4>;
    profiles: Record<string, UserProfile & {password: string}>;
};

function getPath(obj: unknown, dotted: string): unknown {
    let node: unknown = obj;
    for (const part of dotted.split('.')) {
        if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
            node = (node as Record<string, unknown>)[part];
        } else {
            return undefined;
        }
    }
    return node;
}

const CLIENT_CONFIG_REQUEST_RE = /\bGET\s+(\/api\/v4\/config\/client\S*)/;

/**
 * The client-config precondition source is selected by `server_preconditions.source: 'client_config'` or by a
 * `how` that names a literal `GET /api/v4/config/client...` request; anything else is the admin GET /config.
 */
export function clientConfigRequestPath(charter: JourneyCharter): string | null {
    const pre = charter.fixture.server_preconditions;
    if (!pre) {
        return null;
    }
    const named = CLIENT_CONFIG_REQUEST_RE.exec(pre.how ?? '');
    if (named) {
        return named[1].replace(/[.,;)]+$/, '');
    }
    return pre.source === 'client_config' ? '/api/v4/config/client?format=old' : null;
}

export type ClientConfigPreconditions = {report: string[]; buildIdentity: Array<[string, string]>};

/**
 * Read-only, unauthenticated GET of the client config (the values the webapp acts on) before any fixture exists.
 * Declared keys are compared exactly; build identity keys named in `target_release.build_identity_report` are
 * recorded verbatim and never asserted.
 */
export async function checkClientConfigPreconditions(
    charter: JourneyCharter,
    baseUrl: string,
    requestPath: string,
): Promise<ClientConfigPreconditions> {
    const res = await fetch(`${baseUrl}${requestPath}`, {headers: {'X-Requested-With': 'XMLHttpRequest'}});
    if (res.status !== 200) {
        throw new SetupFailure(`client config read returned HTTP ${res.status}`);
    }
    const config = (await res.json()) as Record<string, unknown>;
    const report: string[] = [];
    for (const [key, expected] of Object.entries(charter.fixture.server_preconditions?.expect ?? {})) {
        const ok = config[key] === expected;
        report.push(`${key}: ${ok ? 'OK' : 'MISMATCH'} (expected ${JSON.stringify(expected)})`);
        if (!ok) {
            throw new SetupFailure(`server precondition ${key} differs from the charter (client config, read-only)`);
        }
    }
    const named = (charter.target_release?.build_identity_report ?? '').match(/\b[A-Z][A-Za-z]+\b/g) ?? [];
    const buildIdentity: Array<[string, string]> = [...new Set(named)]
        .filter((k) => k in config)
        .map((k) => [k, String(config[k])]);
    return {report, buildIdentity};
}

/** Read-only GET /config and compare each declared key; any difference aborts as a setup failure. */
export async function checkServerPreconditions(charter: JourneyCharter, adminClient: Client4): Promise<string[]> {
    const expect = charter.fixture.server_preconditions?.expect ?? {};
    const config = (await adminClient.getConfig()) as unknown;
    const report: string[] = [];
    for (const [key, expected] of Object.entries(expect)) {
        const actual = getPath(config, key);
        let ok: boolean;
        if (typeof expected === 'string' && expected.includes(' or ')) {
            const allowed = expected.split(' or ').map((s) => s.trim());
            ok = allowed.includes(String(actual));
        } else {
            ok = actual === expected;
        }
        report.push(`${key}: ${ok ? 'OK' : 'MISMATCH'} (expected ${JSON.stringify(expected)})`);
        if (!ok) {
            throw new SetupFailure(
                `server precondition ${key} differs from the charter (read-only, config never patched)`,
            );
        }
    }
    return report;
}

async function makeActorClient(
    pw: PlaywrightExtended,
    profile: {username: string; password: string},
): Promise<Client4> {
    const {client, user} = await pw.makeClient({
        username: profile.username,
        password: profile.password,
    });
    if (!user) {
        throw new SetupFailure(`failed to log in actor ${profile.username}`);
    }
    return client;
}

/**
 * Creates one `fixture.posts[]` entry with the client its `as` names (a fixture actor's own session, or the
 * admin when it says admin or names no actor), the body's templates resolved. Anything but the declared status
 * (default 201) is a setup failure.
 */
async function createFixturePost(
    post: Record<string, unknown> & {key: string; channel: string},
    bindings: Bindings,
    adminClient: Client4,
    clientFor: (id: string) => Promise<Client4>,
    actors: Record<string, unknown>,
): Promise<{id: string}> {
    const as = String(post.as ?? '').trim();
    const named = /^([A-Za-z0-9_-]+)/.exec(as)?.[1];
    const client = named && named.toLowerCase() !== 'admin' && named in actors ? await clientFor(named) : adminClient;
    const request = /^(POST|PUT)\s+(\/api\/v4\/\S+)/.exec(String(post.request ?? 'POST /api/v4/posts'));
    if (!request) {
        throw new SetupFailure(`fixture post ${post.key}: unsupported request`);
    }
    const expectedStatus = Number(/\bexpect\s+(\d{3})\b/.exec(String(post.request ?? ''))?.[1] ?? 201);
    const body = resolveDeep(post.body ?? {}, bindings);
    const res = await fetch(`${client.getUrl()}${resolveTemplate(request[2].replace(/[.,;]+$/, ''), bindings)}`, {
        method: request[1],
        headers: {
            Authorization: `Bearer ${client.getToken()}`,
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as {id?: unknown};
    if (res.status !== expectedStatus || typeof json.id !== 'string') {
        throw new SetupFailure(`fixture post ${post.key}: HTTP ${res.status} (expected ${expectedStatus})`);
    }
    return {id: json.id};
}

/**
 * Builds a brand-new team, users, channels, memberships, preferences and viewed-last state through the
 * repo lib's admin and per-user REST clients, exactly as charter.fixture declares. Fresh per replay.
 */
export async function createFixture(pw: PlaywrightExtended, charter: JourneyCharter): Promise<Fixture> {
    const f = charter.fixture;
    const slug = pw.random.id();
    const {adminClient, adminUser} = await pw.getAdminClient();
    if (!adminUser) {
        throw new SetupFailure('admin login failed');
    }

    const sub = (template: string) => template.replace(/\{slug\}/g, slug);

    const teamName = sub(f.team!.name_template);
    const team = await adminClient.createTeam({
        name: teamName,
        display_name: `Team ${slug}`,
        type: f.team!.type as 'O',
    } as never);

    const profiles: Record<string, UserProfile & {password: string}> = {};
    const actorById: Record<string, {id: string; username: string; password: string; email: string}> = {};
    for (const actor of f.actors ?? []) {
        const username = sub(actor.username_template!);
        const email = sub(actor.email_template!);
        const password = pw.newTestPassword();
        const created = await adminClient.createUser(
            {
                username,
                email,
                password,
                first_name: actor.first_name ?? '',
                last_name: actor.last_name ?? '',
            } as UserProfile,
            '',
            '',
        );
        const profile = {...created, password};
        profiles[actor.id] = profile;
        actorById[actor.id] = {id: created.id, username, password, email};
        if (actor.team_member) {
            await adminClient.addToTeam(team.id, created.id);
        }
    }

    const channelById: Record<string, {id: string; name: string; display_name: string}> = {};
    const channelKeyByActorMembers: Array<{key: string; members: string[]}> = [];
    for (const ch of f.channels ?? []) {
        const key = ch.key as string;
        const name = sub(ch.name_template as string);
        const display_name = ch.display_name as string;
        const created = await adminClient.createChannel({
            team_id: team.id,
            name,
            display_name,
            type: (ch.api_type as 'O') ?? 'O',
        });
        channelById[key] = {id: created.id, name: created.name, display_name};
        const members = (ch.members as string[]) ?? [];
        channelKeyByActorMembers.push({key, members});
        for (const memberId of members) {
            await adminClient.addToChannel(actorById[memberId].id, created.id);
        }
    }

    const bindings: Bindings = {
        team: {id: team.id, name: team.name},
        actor: actorById,
        channel: channelById,
        event: {},
        fixture: {fixed_strings: f.fixed_strings ?? {}},
    };

    // Preferences and viewed-last are written by each affected actor's own client.
    const actorClients: Record<string, Client4> = {};
    const clientFor = async (id: string) => {
        if (!actorClients[id]) {
            actorClients[id] = await makeActorClient(pw, actorById[id]);
        }
        return actorClients[id];
    };

    if (f.posts) {
        bindings.post = {};
        for (const post of f.posts) {
            bindings.post[post.key] = await createFixturePost(post, bindings, adminClient, clientFor, actorById);
        }
    }

    const prefsByActor = new Map<
        string,
        Array<{
            user_id: string;
            category: string;
            name: string;
            value: string;
        }>
    >();
    for (const pref of f.preferences ?? []) {
        const actorId = pref.actor as string;
        const name = resolveTemplate(pref.name as string, bindings);
        const entry = {
            user_id: actorById[actorId].id,
            category: pref.category as string,
            name,
            value: pref.value as string,
        };
        const list = prefsByActor.get(actorId) ?? [];
        list.push(entry);
        prefsByActor.set(actorId, list);
    }
    for (const [actorId, prefs] of prefsByActor) {
        await (await clientFor(actorId)).savePreferences(actorById[actorId].id, prefs);
    }

    // viewed_last: the member views every channel it belongs to, declaration order reversed, so the
    // first-declared channel is viewed last (charter: lounge then incidents). No write follows this.
    // The UI actor is charter.start.actor (the one who drives the browser).
    const viewer = (f.actors ?? []).find((a: JourneyActor) => a.id === charter.start.actor);
    if (viewer) {
        const viewerClient = await clientFor(viewer.id);
        const viewerChannels = channelKeyByActorMembers.filter((c) => c.members.includes(viewer.id)).map((c) => c.key);
        for (const key of [...viewerChannels].reverse()) {
            await viewerClient.viewMyChannel(channelById[key].id);
        }
    }

    return {bindings, slug, adminClient, actorClients, profiles};
}

/** Logs in (or reuses) the named actor's own REST client. */
export async function actorClient(pw: PlaywrightExtended, fx: Fixture, actorId: string): Promise<Client4> {
    if (!fx.actorClients[actorId]) {
        fx.actorClients[actorId] = await makeActorClient(pw, fx.bindings.actor[actorId]);
    }
    return fx.actorClients[actorId];
}

export type ChannelUnreadCounts = {
    msg_count?: number;
    msg_count_root?: number;
    mention_count?: number;
    mention_count_root?: number;
};

/**
 * GET /users/{user}/channels/{channel}/unread with the given session. Its counts are unread (channel total minus
 * the member's read cursor); the member record's msg_count/msg_count_root are the cursor itself.
 */
export async function readChannelUnread(
    client: Client4,
    bindings: Bindings,
    actorId: string,
    channelKey: string,
): Promise<ChannelUnreadCounts> {
    const {status, json} = await restRequest(
        client,
        `GET /api/v4/users/{actor.${actorId}.id}/channels/{channel.${channelKey}.id}/unread`,
        bindings,
    );
    if (status !== 200) {
        throw new SetupFailure(`read-back: unread read for ${channelKey} returned HTTP ${status}`);
    }
    return json as ChannelUnreadCounts;
}

/**
 * Null when the channel reads back viewed clean, else the setup-failure message (counts only). Mentions-only
 * (`mark_unread: 'mention'`) makes the endpoint report msg counts as 0, so it is refused rather than trusted.
 */
export function unreadReadBackProblem(
    channelKey: string,
    unread: ChannelUnreadCounts,
    markUnread: unknown,
): string | null {
    if (markUnread === 'mention') {
        return `read-back: ${channelKey} mark_unread is 'mention' (unread msgs would be masked)`;
    }
    const mentions = Number(unread.mention_count ?? 0) + Number(unread.mention_count_root ?? 0);
    const msgs = Number(unread.msg_count ?? 0) + Number(unread.msg_count_root ?? 0);
    if (mentions !== 0 || msgs !== 0) {
        return `read-back: ${channelKey} not viewed clean (unread mentions ${mentions}, unread msgs ${msgs})`;
    }
    return null;
}

/** The five read-back checks; any mismatch is a setup failure, never a finding. Returns a sanitized report. */
export async function readBack(charter: JourneyCharter, fx: Fixture): Promise<string[]> {
    const b = fx.bindings;
    const report: string[] = [];
    const channels = charter.fixture.channels ?? [];
    // Checks that only some journeys declare run only when the charter's read_back names them.
    const readBackText = charter.fixture.read_back ?? '';
    const checksAutoFollow = /auto[-_ ]follow/i.test(readBackText);
    const checksThreads = /\bthreads?\b/i.test(readBackText);

    // (1) membership and (2) auto-follow not 'on' for the UI actor's memberships.
    const viewer = (charter.fixture.actors ?? []).find((a) => a.id === charter.start.actor);
    for (const ch of channels) {
        const key = ch.key as string;
        const members = (ch.members as string[]) ?? [];
        const memberRows = await fx.adminClient.getChannelMembers(b.channel[key].id);
        for (const memberId of members) {
            if (!memberRows.some((m) => m.user_id === b.actor[memberId].id)) {
                throw new SetupFailure(`read-back: ${memberId} is not a member of channel ${key}`);
            }
        }
        if (viewer && members.includes(viewer.id)) {
            const member = await fx.adminClient.getChannelMember(b.channel[key].id, b.actor[viewer.id].id);
            if (checksAutoFollow && member.notify_props?.channel_auto_follow_threads === 'on') {
                throw new SetupFailure(`read-back: auto-follow already on for ${key}`);
            }
            const unread = await readChannelUnread(fx.actorClients[viewer.id], b, viewer.id, key);
            if (process.env.JOURNEY_DEBUG) {
                // eslint-disable-next-line no-console
                console.log(
                    `[readback] ${key} unread mention=${unread.mention_count}/${unread.mention_count_root} msg=${unread.msg_count}/${unread.msg_count_root}`,
                );
            }
            const problem = unreadReadBackProblem(key, unread, member.notify_props?.mark_unread);
            if (problem) {
                throw new SetupFailure(problem);
            }
        }
        report.push(`channel ${key}: members present, ${checksAutoFollow ? 'auto-follow not on, ' : ''}viewed clean`);
    }

    // (3) preferences stored.
    if (viewer) {
        const viewerClient = fx.actorClients[viewer.id];
        const stored = (await viewerClient.getUserPreferences(b.actor[viewer.id].id)) as Array<{
            category: string;
            name: string;
            value: string;
        }>;
        for (const pref of charter.fixture.preferences ?? []) {
            if ((pref.actor as string) !== viewer.id) {
                continue;
            }
            const name = resolveTemplate(pref.name as string, b);
            const found = stored.some(
                (p) => p.category === pref.category && p.name === name && p.value === (pref.value as string),
            );
            if (!found) {
                throw new SetupFailure(`read-back: preference ${pref.category}/${name} not stored`);
            }
        }
        report.push(`preferences: all ${(charter.fixture.preferences ?? []).length} stored`);
    }

    // (4) no user post (type '') in the first channel that declares seeded_posts None.
    const noPostChannel = channels.find((c) => String(c.seeded_posts ?? '').startsWith('None'));
    if (noPostChannel) {
        const posts = await fx.adminClient.getPosts(b.channel[noPostChannel.key as string].id);
        const userPosts = Object.values(posts.posts).filter((p) => p.type === '');
        if (userPosts.length !== 0) {
            throw new SetupFailure(`read-back: channel ${noPostChannel.key} already has a user post`);
        }
        report.push(`channel ${noPostChannel.key as string}: no user post`);
    }

    // (5) the UI actor's followed-thread list is empty.
    if (viewer && checksThreads) {
        const list = await fx.actorClients[viewer.id].getUserThreads(b.actor[viewer.id].id, b.team.id, {});
        if ((list.threads?.length ?? 0) !== 0) {
            throw new SetupFailure('read-back: followed-thread list is not empty');
        }
        report.push('followed threads: zero');
    }

    return report;
}
