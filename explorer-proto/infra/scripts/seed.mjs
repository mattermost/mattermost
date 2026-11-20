#!/usr/bin/env node
// Deterministic, idempotent API seed for the pilot. Values come from explorer-proto/scenarios.json.
//   node seed.mjs [--variant=default|swap-purpose-header|no-archive]
// Variants change seed data only: swap-purpose-header swaps purpose/header between qa-sandbox and
// release-planning; no-archive leaves legacy-roadmap active. Names, URLs and membership never change.
import fs from 'node:fs';
import path from 'node:path';

import {Api, BASE_URL, MANIFEST_PATH, adminApi, expectedState, login, onboardingPreferences, parseVariant} from './api.mjs';

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

async function main() {
    const variant = parseVariant(process.argv.slice(2));
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

    const session = await login(want.user.username, want.user.password);
    if (!session) {
        throw new Error(`${want.user.username} cannot log in after seeding`);
    }
    const asUser = new Api(session.token);
    await asUser.req('PUT', '/users/me/preferences', onboardingPreferences(user.id));
    for (const name of want.viewOrder) {
        await asUser.req('POST', '/channels/members/me/view', {channel_id: channels[name].id, prev_channel_id: ''});
    }
    say(`marked viewed last: ${want.viewOrder.join(', ')}`);

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
    fs.mkdirSync(path.dirname(MANIFEST_PATH), {recursive: true});
    fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
    say(`manifest written: ${path.relative(process.cwd(), MANIFEST_PATH)}`);
}

main().catch((err) => {
    say(`FAILED: ${err.message}`);
    process.exit(1);
});
