#!/usr/bin/env node
// Reads the seeded state back through the admin API and compares it with scenarios.json for the variant.
//   node verify_seed.mjs [--variant=...] [--session=bookmarks|none]
// Prints one PASS/FAIL line per check, exit 1 on any FAIL. --session=bookmarks adds the charter bookmark
// checks; --session=none adds a check that qa-sandbox and release-planning hold zero bookmarks.
import fs from 'node:fs';

import {
    Api,
    BASE_URL,
    MANIFEST_PATH,
    adminApi,
    bookmarkSpecs,
    expectedState,
    listBookmarks,
    login,
    onboardingPreferences,
    parseSession,
    parseVariant,
} from './api.mjs';

const BOOKMARK_CHANNELS = ['qa-sandbox', 'release-planning'];

let failures = 0;
function check(ok, desc) {
    process.stdout.write(`[DIRECT  ] ${ok ? 'PASS' : 'FAIL'} ${desc}\n`);
    if (!ok) {
        failures++;
    }
}

// Returns the non-deleted bookmarks, or null (after a FAIL line) when the list call fails.
async function bookmarksOrFail(api, channelId, label, who) {
    try {
        return await listBookmarks(api, channelId, label);
    } catch (err) {
        check(false, `${who} can list bookmarks of ${label} (${err.message})`);
        return null;
    }
}

async function verifyBookmarks(admin, want, team, user, manifest) {
    const adminId = (await admin.req('GET', '/users/me')).body?.id;
    const userSession = await login(want.user.username, want.user.password);
    const asUser = userSession ? new Api(userSession.token) : null;
    const origin = new URL(BASE_URL).origin;

    for (const spec of bookmarkSpecs(want.team.name)) {
        const ch = await admin.req('GET', `/teams/${team?.id}/channels/name/${spec.channel}`, undefined, {allow: [404]});
        const channelId = ch.body?.id;
        const list = await bookmarksOrFail(admin, channelId, spec.channel, 'admin');
        if (!list) {
            continue;
        }
        check(list.length === 1, `${spec.channel} has exactly one non-deleted bookmark (got ${list.length})`);
        const b = (list.length === 1 ? list[0] : list.find((x) => x.display_name === spec.display_name)) || {};
        check(list.length === 1 && b.display_name === spec.display_name, `${spec.channel} bookmark display_name = "${spec.display_name}"`);
        check(b.type === 'link', `${spec.channel} bookmark type = "link"`);
        check(!b.emoji && !b.image_url && !b.file_id, `${spec.channel} bookmark has no emoji, image_url or file`);
        let url = null;
        try {
            url = new URL(b.link_url);
        } catch {
            url = null;
        }
        check(url !== null && url.origin === origin && url.pathname === spec.url_path && !url.search && !url.hash,
            `${spec.channel} bookmark link_url origin = manifest base_url origin, path = ${spec.url_path}`);
        check(Boolean(adminId) && b.owner_id === adminId, `${spec.channel} bookmark owned by the seeding admin`);
        const m = manifest?.session?.bookmarks?.[spec.channel];
        check(m?.id === b.id && m.display_name === b.display_name && m.type === b.type && m.link_url === b.link_url,
            `manifest session.bookmarks["${spec.channel}"] matches the read-back bookmark`);

        const cm = await admin.req('GET', `/channels/${channelId}/members/${user?.id}`, undefined, {allow: [403, 404]});
        const roles = cm.body?.roles?.split(' ') || [];
        check(cm.status === 200 && roles.includes('channel_user') && !roles.includes('channel_admin') && !cm.body.scheme_admin,
            `${want.user.username} is a regular member of ${spec.channel} (channel roles "${cm.body?.roles}")`);
        const seen = asUser ? await bookmarksOrFail(asUser, channelId, spec.channel, want.user.username) : null;
        if (seen) {
            check(seen.length === 1 && seen[0].id === b.id, `${want.user.username} can list ${spec.channel} bookmarks and sees the same single bookmark`);
        } else if (!asUser) {
            check(false, `${want.user.username} logs in to list bookmarks`);
        }
    }
    check(manifest?.session?.name === 'bookmarks', 'manifest session.name = "bookmarks"');
}

async function verifyNoBookmarks(admin, team) {
    for (const name of BOOKMARK_CHANNELS) {
        const ch = await admin.req('GET', `/teams/${team?.id}/channels/name/${name}`, undefined, {allow: [404]});
        const list = await bookmarksOrFail(admin, ch.body?.id, name, 'admin');
        if (list) {
            check(list.length === 0, `${name} has zero bookmarks (got ${list.length})`);
        }
    }
}

async function main() {
    const argv = process.argv.slice(2);
    const variant = parseVariant(argv);
    const session = parseSession(argv, ['bookmarks', 'none']);
    const want = expectedState(variant);
    const admin = await adminApi();
    process.stdout.write(`seed read-back, variant=${variant}${session ? `, session=${session}` : ''}\n`);

    const team = await admin.req('GET', `/teams/name/${want.team.name}`, undefined, {allow: [404]});
    check(team.status === 200 && team.body.display_name === want.team.display_name && team.body.type === want.team.type,
        `team ${want.team.name} exists, display_name "${want.team.display_name}", type ${want.team.type}`);

    const user = await admin.req('GET', `/users/username/${want.user.username}`, undefined, {allow: [404]});
    check(user.status === 200 && user.body.roles === 'system_user', `user ${want.user.username} exists with roles "system_user" (got "${user.body?.roles}")`);
    check(Boolean(await login(want.user.username, want.user.password)), `${want.user.username} logs in with the synthetic password`);

    const member = await admin.req('GET', `/teams/${team.body?.id}/members/${user.body?.id}`, undefined, {allow: [403, 404]});
    const teamRoles = member.body?.roles?.split(' ') || [];
    check(member.status === 200 && teamRoles.includes('team_user') && !teamRoles.includes('team_admin') && !member.body.scheme_admin,
        `${want.user.username} is a regular team member (team roles "${member.body?.roles}")`);

    const prefs = await admin.req('GET', `/users/${user.body?.id}/preferences`, undefined, {allow: [403, 404]});
    const prefOk = onboardingPreferences(user.body?.id).every((p) =>
        (prefs.body || []).some((q) => q.category === p.category && q.name === p.name && q.value === p.value));
    check(prefOk, 'onboarding/tutorial preferences set (4 of 4)');

    for (const spec of want.channels) {
        const ch = await admin.req('GET', `/teams/${team.body?.id}/channels/name/${spec.name}?include_deleted=true`, undefined, {allow: [404]});
        const c = ch.body || {};
        check(ch.status === 200 && c.type === spec.type, `${spec.name} exists, type ${spec.type}`);
        check(c.display_name === spec.display_name, `${spec.name} display_name = "${spec.display_name}"`);
        check(c.purpose === spec.purpose, `${spec.name} purpose = "${spec.purpose}"`);
        check(c.header === spec.header, `${spec.name} header = "${spec.header}"`);
        if (spec.archived) {
            check(c.delete_at > 0, `${spec.name} archived (delete_at > 0)`);
        } else {
            check(c.delete_at === 0, `${spec.name} active (delete_at == 0)`);
        }
        const cm = await admin.req('GET', `/channels/${c.id}/members/${user.body?.id}`, undefined, {allow: [403, 404]});
        check(cm.status === 200, `${want.user.username} is a member of ${spec.name}`);
        if (want.viewOrder.includes(spec.name)) {
            const unread = await admin.req('GET', `/users/${user.body?.id}/channels/${c.id}/unread`, undefined, {allow: [403, 404]});
            check(unread.status === 200 && unread.body.msg_count === 0 && unread.body.mention_count === 0,
                `${spec.name} fully read by ${want.user.username} (msg_count=${unread.body?.msg_count}, mention_count=${unread.body?.mention_count})`);
        }
    }

    let manifest = null;
    try {
        manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    } catch {
        manifest = null;
    }
    const manifestOk = manifest?.schema === 'explorer-pilot-seed/v1' && manifest.variant === variant &&
        manifest.team?.id === team.body?.id && manifest.user?.id === user.body?.id &&
        want.channels.every((s) => manifest.channels?.[s.name]?.purpose === s.purpose && manifest.channels[s.name].archived === s.archived);
    check(manifestOk, '.run/seed-manifest.json matches the read-back state');

    if (session === 'bookmarks') {
        await verifyBookmarks(admin, want, team.body, user.body, manifest);
    } else if (session === 'none') {
        await verifyNoBookmarks(admin, team.body);
    }

    process.stdout.write(`seed read-back: ${failures === 0 ? 'PASS' : `FAIL (${failures})`}\n`);
    return failures === 0;
}

main().then((ok) => process.exit(ok ? 0 : 1), (err) => {
    process.stdout.write(`seed read-back: FAIL (${err.message})\n`);
    process.exit(1);
});
