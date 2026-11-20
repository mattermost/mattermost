#!/usr/bin/env node
// Reads the seeded state back through the admin API and compares it with scenarios.json for the variant.
//   node verify_seed.mjs [--variant=...]     prints one PASS/FAIL line per check, exit 1 on any FAIL
import fs from 'node:fs';

import {MANIFEST_PATH, adminApi, expectedState, login, onboardingPreferences, parseVariant} from './api.mjs';

let failures = 0;
function check(ok, desc) {
    process.stdout.write(`[DIRECT  ] ${ok ? 'PASS' : 'FAIL'} ${desc}\n`);
    if (!ok) {
        failures++;
    }
}

async function main() {
    const variant = parseVariant(process.argv.slice(2));
    const want = expectedState(variant);
    const admin = await adminApi();
    process.stdout.write(`seed read-back, variant=${variant}\n`);

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

    process.stdout.write(`seed read-back: ${failures === 0 ? 'PASS' : `FAIL (${failures})`}\n`);
    return failures === 0;
}

main().then((ok) => process.exit(ok ? 0 : 1), (err) => {
    process.stdout.write(`seed read-back: FAIL (${err.message})\n`);
    process.exit(1);
});
