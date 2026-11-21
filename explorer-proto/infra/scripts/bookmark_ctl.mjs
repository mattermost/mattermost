#!/usr/bin/env node
// Bookmark helpers for the bookmarks session (run against a stack seeded with --session=bookmarks).
//   node bookmark_ctl.mjs patch --channel=<name> --title=<new title>   prints PASS or FAIL (reason) only
//   node bookmark_ctl.mjs read --channel=<name>                        prints the display_name list (JSON) only
// patch uses the seeding admin, which must own the bookmark: in v12.1.0 a non-owner patch soft-deletes the
// bookmark and saves a copy with a new id (server/channels/app/channel_bookmark.go:77-95), so this refuses
// to patch a bookmark it does not own. Output never contains ids, URLs or the origin.
import {adminApi, listBookmarks, parseFlag, readManifest} from './api.mjs';

async function channelId(admin, manifest, name) {
    const fromManifest = manifest?.channels?.[name]?.id;
    const teamName = manifest?.team?.name;
    if (!fromManifest || !teamName) {
        throw new Error(`seed manifest has no channel ${name}`);
    }
    const ch = await admin.req('GET', `/teams/name/${teamName}/channels/name/${name}`, undefined, {allow: [404]});
    if (ch.status !== 200 || ch.body.id !== fromManifest) {
        throw new Error(`channel ${name} does not match the seed manifest`);
    }
    return fromManifest;
}

async function patch(admin, manifest, name, title) {
    if (!title) {
        throw new Error('--title is required');
    }
    const id = await channelId(admin, manifest, name);
    const bookmarkId = manifest?.session?.bookmarks?.[name]?.id;
    if (!bookmarkId) {
        throw new Error(`seed manifest has no session bookmark for ${name}`);
    }
    const adminId = (await admin.req('GET', '/users/me')).body.id;
    const list = await listBookmarks(admin, id, name);
    if (list.length !== 1 || list[0].id !== bookmarkId) {
        throw new Error(`${name} does not hold exactly the manifest bookmark`);
    }
    if (list[0].owner_id !== adminId) {
        throw new Error(`${name} bookmark is not owned by the seeding admin; refusing (would recreate with a new id)`);
    }
    const res = await admin.req('PATCH', `/channels/${id}/bookmarks/${bookmarkId}`, {display_name: title}, {anyStatus: true});
    if (res.status !== 200) {
        throw new Error(`PATCH returned HTTP ${res.status}${res.status === 501 ? ' (server not licensed)' : ''}`);
    }
    if (res.body?.updated?.id !== bookmarkId || res.body.deleted || res.body.updated.display_name !== title) {
        throw new Error('PATCH response is not an in-place update of the same bookmark');
    }
    const after = await listBookmarks(admin, id, name);
    if (after.length !== 1 || after[0].id !== bookmarkId || after[0].display_name !== title) {
        throw new Error('read-back after PATCH does not show the new title on the same bookmark');
    }
}

async function main() {
    const [cmd, ...argv] = process.argv.slice(2);
    const name = parseFlag(argv, 'channel');
    if (!['patch', 'read'].includes(cmd) || !name) {
        process.stdout.write('usage: bookmark_ctl.mjs patch --channel=<name> --title=<title> | read --channel=<name>\n');
        return 2;
    }
    const manifest = readManifest();
    const admin = await adminApi();
    if (cmd === 'read') {
        const list = await listBookmarks(admin, await channelId(admin, manifest, name), name);
        process.stdout.write(`${JSON.stringify(list.map((b) => b.display_name))}\n`);
        return 0;
    }
    try {
        await patch(admin, manifest, name, parseFlag(argv, 'title'));
    } catch (err) {
        process.stdout.write(`FAIL (${err.message})\n`);
        return 1;
    }
    process.stdout.write('PASS\n');
    return 0;
}

main().then((code) => process.exit(code), (err) => {
    process.stdout.write(`FAIL (${err.message})\n`);
    process.exit(1);
});
