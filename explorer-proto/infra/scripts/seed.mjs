#!/usr/bin/env node
// Deterministic, idempotent API seed for the pilot. Values come from explorer-proto/scenarios.json.
//   node seed.mjs [--variant=default|swap-purpose-header|no-archive] [--session=bookmarks]
// Variants change seed data only: swap-purpose-header swaps purpose/header between qa-sandbox and
// release-planning; no-archive leaves legacy-roadmap active. Names, URLs and membership never change.
// --session=bookmarks additionally seeds one link bookmark per channel from sessions/bookmarks/charter.json
// (needs a licensed server). Without it, no bookmark endpoint is called.
import fs from 'node:fs';
import path from 'node:path';

import {
    Api,
    BASE_URL,
    MANIFEST_PATH,
    adminApi,
    bookmarkSetupFailure,
    bookmarkSpecs,
    expectedState,
    listBookmarks,
    login,
    onboardingPreferences,
    parseSession,
    parseVariant,
} from './api.mjs';

const say = (msg) => process.stdout.write(`[seed] ${msg}\n`);

async function ensureTeam(admin, team) {
    const found = await admin.req('GET', `/teams/name/${team.name}`, undefined, {allow: [404]});
    if (found.status === 404) {
        const created = await admin.req('POST', '/teams', team);
        say(`team ${team.name} created`);
        return created.body;
    }
    if (found.body.type !== team.type) {
        throw new Error(`team ${team.name} exists with type ${found.body.type}, expected ${team.type}`);
    }
    const patched = await admin.req('PUT', `/teams/${found.body.id}/patch`, {display_name: team.display_name});
    say(`team ${team.name} exists, display name ensured`);
    return patched.body;
}

async function ensureUser(admin, user) {
    const found = await admin.req('GET', `/users/username/${user.username}`, undefined, {allow: [404]});
    let profile = found.body;
    if (found.status === 404) {
        profile = (await admin.req('POST', '/users', {username: user.username, email: user.email, password: user.password})).body;
        say(`user ${user.username} created`);
    } else {
        say(`user ${user.username} exists`);
    }
    if (profile.roles !== 'system_user') {
        throw new Error(`user ${user.username} has roles "${profile.roles}", expected "system_user"`);
    }
    if (!(await login(user.username, user.password))) {
        await admin.req('PUT', `/users/${profile.id}/password`, {new_password: user.password});
        say(`user ${user.username} password reset to the synthetic value`);
    }
    return profile;
}

async function ensureChannel(admin, teamId, spec, userId) {
    const found = await admin.req('GET', `/teams/${teamId}/channels/name/${spec.name}?include_deleted=true`, undefined, {
        allow: [404],
    });
    let channel = found.body;
    if (found.status === 404) {
        const body = {team_id: teamId, name: spec.name, display_name: spec.display_name, type: spec.type, purpose: spec.purpose, header: spec.header};
        channel = (await admin.req('POST', '/channels', body)).body;
        say(`channel ${spec.name} created`);
    } else {
        if (channel.type !== spec.type) {
            throw new Error(`channel ${spec.name} exists with type ${channel.type}, expected ${spec.type}`);
        }
        if (channel.delete_at > 0) {
            channel = (await admin.req('POST', `/channels/${channel.id}/restore`)).body;
            say(`channel ${spec.name} restored before re-seeding`);
        }
    }
    await admin.req('POST', `/channels/${channel.id}/members`, {user_id: userId});
    channel = (await admin.req('PUT', `/channels/${channel.id}/patch`, {display_name: spec.display_name, purpose: spec.purpose, header: spec.header})).body;

    if (spec.archived) {
        await admin.req('DELETE', `/channels/${channel.id}`);
        channel = (await admin.req('GET', `/channels/${channel.id}`)).body;
        if (!(channel.delete_at > 0)) {
            throw new Error(`channel ${spec.name} archive did not set delete_at`);
        }
    }
    say(`channel ${spec.name} ready (archived=${channel.delete_at > 0})`);
    return channel;
}

const matchesSpec = (b, spec, ownerId) =>
    b.display_name === spec.display_name && b.type === spec.type && b.link_url === spec.link_url &&
    !b.emoji && !b.image_url && !b.file_id && b.owner_id === ownerId;

// Leaves exactly one bookmark (the declared one, owned by the seeding admin) in the channel.
async function ensureBookmark(admin, adminId, channel, spec) {
    const existing = await listBookmarks(admin, channel.id, spec.channel);
    const keep = existing.find((b) => matchesSpec(b, spec, adminId));
    for (const b of existing.filter((x) => x !== keep)) {
        const del = await admin.req('DELETE', `/channels/${channel.id}/bookmarks/${b.id}`, undefined, {anyStatus: true});
        if (del.status !== 200) {
            throw bookmarkSetupFailure(`DELETE extra bookmark in ${spec.channel}`, del.status);
        }
    }
    let bookmark = keep;
    if (keep) {
        say(`bookmark in ${spec.channel} exists (kept; ${existing.length - 1} extra deleted)`);
    } else {
        const body = {display_name: spec.display_name, type: spec.type, link_url: spec.link_url};
        const created = await admin.req('POST', `/channels/${channel.id}/bookmarks`, body, {anyStatus: true});
        if (created.status !== 201 || !created.body?.id) {
            throw bookmarkSetupFailure(`POST bookmark in ${spec.channel}`, created.status);
        }
        bookmark = created.body;
        say(`bookmark in ${spec.channel} created (${existing.length} other deleted)`);
    }
    const after = await listBookmarks(admin, channel.id, spec.channel);
    if (after.length !== 1 || after[0].id !== bookmark.id || !matchesSpec(after[0], spec, adminId)) {
        throw new Error(`setup failure: licence/bookmarks: ${spec.channel} does not hold exactly the declared bookmark after seeding`);
    }
    return after[0];
}

async function main() {
    const argv = process.argv.slice(2);
    const variant = parseVariant(argv);
    const session = parseSession(argv, ['bookmarks']);
    const want = expectedState(variant);
    say(`variant=${variant} base=${BASE_URL}`);

    const admin = await adminApi();
    const team = await ensureTeam(admin, want.team);
    const user = await ensureUser(admin, want.user);
    await admin.req('POST', `/teams/${team.id}/members`, {team_id: team.id, user_id: user.id});

    const channels = {};
    for (const spec of want.channels) {
        channels[spec.name] = await ensureChannel(admin, team.id, spec, user.id);
    }

    const bookmarks = {};
    if (session === 'bookmarks') {
        const adminId = (await admin.req('GET', '/users/me')).body.id;
        for (const spec of bookmarkSpecs(team.name)) {
            if (!channels[spec.channel] || channels[spec.channel].delete_at > 0) {
                throw new Error(`bookmarks charter: channel ${spec.channel} is not an active seeded channel`);
            }
            bookmarks[spec.channel] = await ensureBookmark(admin, adminId, channels[spec.channel], spec);
        }
    }

    const userSession = await login(want.user.username, want.user.password);
    if (!userSession) {
        throw new Error(`${want.user.username} cannot log in after seeding`);
    }
    const asUser = new Api(userSession.token);
    await asUser.req('PUT', '/users/me/preferences', onboardingPreferences(user.id));
    for (const name of want.viewOrder) {
        await asUser.req('POST', '/channels/members/me/view', {channel_id: channels[name].id, prev_channel_id: ''});
    }
    say(`marked viewed last: ${want.viewOrder.join(', ')}`);

    if (session) {
        for (const name of want.viewOrder) {
            const unread = (await admin.req('GET', `/users/${user.id}/channels/${channels[name].id}/unread`)).body;
            if (unread?.msg_count !== 0 || unread?.mention_count !== 0) {
                throw new Error(`${name} still unread for ${want.user.username} after the view calls`);
            }
        }
        say(`read state confirmed: ${want.viewOrder.join(', ')} have msg_count=0 and mention_count=0`);
    }

    const manifest = {
        schema: 'explorer-pilot-seed/v1',
        base_url: BASE_URL,
        variant,
        team: {id: team.id, name: team.name, display_name: team.display_name},
        user: {id: user.id, username: want.user.username, password: want.user.password, email: want.user.email, roles: user.roles},
        channels: Object.fromEntries(
            want.channels.map((spec) => {
                const c = channels[spec.name];
                return [
                    spec.name,
                    {
                        id: c.id,
                        name: c.name,
                        display_name: c.display_name,
                        purpose: c.purpose,
                        header: c.header,
                        archived: c.delete_at > 0,
                        url_path: `/${team.name}/channels/${c.name}`,
                    },
                ];
            }),
        ),
    };
    if (session === 'bookmarks') {
        manifest.session = {
            name: session,
            bookmarks: Object.fromEntries(
                Object.entries(bookmarks).map(([name, b]) => [name, {id: b.id, display_name: b.display_name, type: b.type, link_url: b.link_url}]),
            ),
        };
    }
    fs.mkdirSync(path.dirname(MANIFEST_PATH), {recursive: true});
    fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
    say(`manifest written: ${path.relative(process.cwd(), MANIFEST_PATH)}`);
}

main().catch((err) => {
    say(`FAILED: ${err.message}`);
    process.exit(1);
});
