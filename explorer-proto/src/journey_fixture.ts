// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {UserProfile} from '@mattermost/types/users';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

import {resolveTemplate} from './journey_charter.ts';
import type {Bindings, JourneyActor, JourneyCharter} from './journey_charter.ts';

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

/** The five read-back checks; any mismatch is a setup failure, never a finding. Returns a sanitized report. */
export async function readBack(charter: JourneyCharter, fx: Fixture): Promise<string[]> {
    const b = fx.bindings;
    const report: string[] = [];
    const channels = charter.fixture.channels ?? [];

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
            if (member.notify_props?.channel_auto_follow_threads === 'on') {
                throw new SetupFailure(`read-back: auto-follow already on for ${key}`);
            }
            const mentions =
                Number(member.mention_count ?? 0) +
                Number((member as {mention_count_root?: number}).mention_count_root ?? 0);
            const msgs =
                Number(member.msg_count ?? 0) + Number((member as {msg_count_root?: number}).msg_count_root ?? 0);
            if (process.env.JOURNEY_DEBUG) {
                // eslint-disable-next-line no-console
                console.log(
                    `[readback] ${key} mention=${member.mention_count}/${(member as {mention_count_root?: number}).mention_count_root} msg=${member.msg_count}/${(member as {msg_count_root?: number}).msg_count_root}`,
                );
            }
            if (mentions !== 0 || msgs !== 0) {
                throw new SetupFailure(`read-back: ${key} not viewed clean (mentions ${mentions}, msgs ${msgs})`);
            }
        }
        report.push(`channel ${key}: members present, auto-follow not on, viewed clean`);
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
    if (viewer) {
        const list = await fx.actorClients[viewer.id].getUserThreads(b.actor[viewer.id].id, b.team.id, {});
        if ((list.threads?.length ?? 0) !== 0) {
            throw new SetupFailure('read-back: followed-thread list is not empty');
        }
        report.push('followed threads: zero');
    }

    return report;
}
