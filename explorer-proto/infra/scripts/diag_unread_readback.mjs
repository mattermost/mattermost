#!/usr/bin/env node
// Diagnostic: what a channel member record's counters mean versus the channel-unread endpoint, on synthetic
// data in a fresh team (two synthetic users, public channels), then the engine's own read-back functions from
// src/journey_fixture.ts on the same server. Counts only; never prints ids, generated names, the origin or
// credentials.
//   node diag_unread_readback.mjs        (PW_BASE_URL defaults to the pilot base URL)
// Exit 0 when every expectation printed as PASS holds, 1 otherwise.
import crypto from 'node:crypto';

import {readChannelUnread, unreadReadBackProblem} from '../../src/journey_fixture.ts';

import {Api, BASE_URL, adminApi, login} from './api.mjs';

const PASSWORD = 'Diag-synthetic-4b1e!';
const scrubIds = (text) => String(text).replace(/\b[a-z0-9]{26}\b/g, '<id>');
const out = (text = '') => process.stdout.write(`${text}\n`);
const checks = [];
const expectThat = (label, ok) => {
    checks.push(ok);
    out(`${ok ? 'PASS' : 'FAIL'} ${label}`);
};

async function setup(admin) {
    const tag = `u${crypto.randomBytes(4).toString('hex')}`;
    const team = (
        await admin.req('POST', '/teams', {name: `diagunread-${tag}`, display_name: 'Diag Unread', type: 'O'})
    ).body;
    const users = {};
    for (const who of ['a', 'b']) {
        const user = (
            await admin.req('POST', '/users', {
                username: `diag${who}${tag}`,
                email: `diag${who}${tag}@sample.mattermost.com`,
                password: PASSWORD,
            })
        ).body;
        await admin.req('POST', `/teams/${team.id}/members`, {team_id: team.id, user_id: user.id});
        const session = await login(user.username, PASSWORD);
        users[who] = {id: user.id, username: user.username, api: new Api(session.token), token: session.token};
    }
    return {tag, team, users};
}

async function newChannel(admin, ctx, name) {
    const channel = (
        await admin.req('POST', '/channels', {
            team_id: ctx.team.id,
            name: `${name}-${ctx.tag}`,
            display_name: name,
            type: 'O',
        })
    ).body;
    for (const who of ['a', 'b']) {
        await admin.req('POST', `/channels/${channel.id}/members`, {user_id: ctx.users[who].id});
    }
    return channel;
}

// One reading, entirely through A's own session: member record, unread endpoint, channel totals, posts by type.
async function reading(a, channelId) {
    const member = (await a.api.req('GET', `/channels/${channelId}/members/${a.id}`)).body;
    const unread = (await a.api.req('GET', `/users/${a.id}/channels/${channelId}/unread`)).body;
    const channel = (await a.api.req('GET', `/channels/${channelId}`)).body;
    const posts = Object.values((await a.api.req('GET', `/channels/${channelId}/posts`)).body.posts ?? {});
    return {
        member: [member.msg_count, member.msg_count_root, member.mention_count, member.mention_count_root],
        unread: [unread.msg_count, unread.msg_count_root, unread.mention_count, unread.mention_count_root],
        total: [channel.total_msg_count, channel.total_msg_count_root],
        posts: [posts.filter((p) => p.type === '').length, posts.filter((p) => p.type !== '').length],
        markUnread: member.notify_props?.mark_unread,
    };
}

const header =
    '| step | member msg/root/mention/mention_root | unread msg/root/mention/mention_root | channel total/total_root | total minus member msg/root | posts user/system | member mark_unread |';
const row = (step, r) =>
    `| ${step} | ${r.member.join(' / ')} | ${r.unread.join(' / ')} | ${r.total.join(' / ')} | ${r.total[0] - r.member[0]} / ${r.total[1] - r.member[1]} | ${r.posts.join(' / ')} | ${r.markUnread} |`;

async function post(user, channelId, message) {
    await user.api.req('POST', '/posts', {channel_id: channelId, message});
}

async function view(user, channelId) {
    await user.api.req('POST', '/channels/members/me/view', {channel_id: channelId, prev_channel_id: ''});
}

async function setMarkUnread(user, channelId, value) {
    await user.api.req('PUT', `/channels/${channelId}/members/${user.id}/notify_props`, {
        channel_id: channelId,
        user_id: user.id,
        mark_unread: value,
    });
}

async function main() {
    const admin = await adminApi();
    const ctx = await setup(admin);
    const {a, b} = ctx.users;

    out('## Case 1: plain post by B, A reads (mark_unread all)');
    const ch = await newChannel(admin, ctx, 'diag-plain');
    const r = {};
    r.a = await reading(a, ch.id);
    await post(b, ch.id, 'diagnostic plain text');
    r.b = await reading(a, ch.id);
    await view(a, ch.id);
    r.d = await reading(a, ch.id);
    out(header);
    out('| --- | --- | --- | --- | --- | --- | --- |');
    out(row('(a) before the post', r.a));
    out(row('(b) after B posts, before A views', r.b));
    out(row('(d) after A views', r.d));
    out();
    expectThat(
        '(a) unread msg/root are 0 before the post; mention is 1 (the "added to the channel" system post)',
        `${r.a.unread.slice(0, 3)}` === '0,0,1',
    );
    expectThat('(a) join system posts exist but are not in the channel total', r.a.posts[1] > 0 && r.a.total[0] === 0);
    expectThat(
        '(b) unread endpoint reports the 1 plain post (msg 1, root 1) plus the earlier mention 1',
        `${r.b.unread.slice(0, 3)}` === '1,1,1',
    );
    expectThat("(b) member record unchanged by B's post (it is A's read cursor)", `${r.b.member}` === `${r.a.member}`);
    expectThat(
        'unread msg/root == channel total minus member msg/root at every step',
        [r.a, r.b, r.d].every(
            (x) => x.unread[0] === x.total[0] - x.member[0] && x.unread[1] === x.total[1] - x.member[1],
        ),
    );
    expectThat(
        '(d) unread endpoint is 0 for msg, root and mention after the view',
        r.d.unread.slice(0, 3).every((n) => n === 0),
    );
    expectThat(
        '(d) member msg/root equal the channel total after the view (nonzero)',
        r.d.member[0] === r.d.total[0] && r.d.member[1] === r.d.total[1] && r.d.member[0] > 0,
    );
    expectThat('(d) member mention/mention_root are 0 after the view', r.d.member[2] === 0 && r.d.member[3] === 0);
    const oldSum = r.d.member[0] + r.d.member[1];
    out(`old read-back sum after the view (member msg + msg_root): ${oldSum}`);
    out();

    out('## Self-join comparison: A joins by itself (no "added to the channel" post naming A)');
    const self = (
        await admin.req('POST', '/channels', {
            team_id: ctx.team.id,
            name: `diag-self-${ctx.tag}`,
            display_name: 'diag-self',
            type: 'O',
        })
    ).body;
    await a.api.req('POST', `/channels/${self.id}/members`, {user_id: a.id});
    await admin.req('POST', `/channels/${self.id}/members`, {user_id: b.id});
    const s = await reading(a, self.id);
    out(header);
    out('| --- | --- | --- | --- | --- | --- | --- |');
    out(row('self-join, no post', s));
    out();
    expectThat(
        'self-joined A has unread mention 0, so the case-1 mention comes from the admin add post',
        s.unread[2] === 0 && s.posts[1] > 0,
    );

    out('## (e) notification settings and mentions-only mode');
    const me = (await a.api.req('GET', '/users/me')).body;
    const userProps = me.notify_props ?? {};
    out(`A channel member notify_props.mark_unread: ${r.d.markUnread}`);
    out(
        `A user notify_props.channel: ${userProps.channel}; user notify_props has a mark_unread key: ${'mark_unread' in userProps}`,
    );
    expectThat("A member mark_unread is 'all' by default", r.d.markUnread === 'all');
    const e = {};
    await setMarkUnread(a, ch.id, 'mention');
    e.set = await reading(a, ch.id);
    await post(b, ch.id, 'diagnostic plain text two');
    e.plain = await reading(a, ch.id);
    await post(b, ch.id, `@${a.username} diagnostic mention`);
    e.mention = await reading(a, ch.id);
    await setMarkUnread(a, ch.id, 'all');
    e.restored = await reading(a, ch.id);
    await view(a, ch.id);
    e.viewed = await reading(a, ch.id);
    out(header);
    out('| --- | --- | --- | --- | --- | --- | --- |');
    out(row("(e1) mark_unread set to 'mention'", e.set));
    out(row('(e2) B plain post, A not viewed', e.plain));
    out(row('(e3) B mentions A, A not viewed', e.mention));
    out(row("(e4) mark_unread restored to 'all'", e.restored));
    out(row('(e5) A views', e.viewed));
    out();
    expectThat(
        '(e2) mentions-only mode masks the unread plain post: unread msg/root read 0 while total minus member is 1',
        `${e.plain.unread.slice(0, 2)}` === '0,0' && e.plain.total[0] - e.plain.member[0] === 1,
    );
    expectThat('(e3) mentions are still reported in mentions-only mode (mention 1)', e.mention.unread[2] === 1);
    expectThat(
        "(e4) restoring 'all' reveals the 2 unread posts without any view",
        `${e.restored.unread.slice(0, 3)}` === '2,2,1',
    );
    expectThat(
        '(e5) view clears every unread counter',
        e.viewed.unread.every((n) => n === 0),
    );
    out();

    out('## Live check: the engine read-back functions (journey_fixture.ts) on 12.1.0');
    const live = await newChannel(admin, ctx, 'diag-live');
    const bindings = {actor: {a: {id: a.id}, b: {id: b.id}}, channel: {live: {id: live.id}}};
    const clientOf = (user) => ({getUrl: () => BASE_URL, getToken: () => user.token});
    const check = async () => {
        const member = (await a.api.req('GET', `/channels/${live.id}/members/${a.id}`)).body;
        const unread = await readChannelUnread(clientOf(a), bindings, 'a', 'live');
        return {member, unread, problem: unreadReadBackProblem('live', unread, member.notify_props?.mark_unread)};
    };
    await view(a, live.id);
    await post(b, live.id, 'diagnostic plain text');
    const poster = await readChannelUnread(clientOf(b), bindings, 'b', 'live');
    out(
        `poster B's own unread after posting (msg/root/mention): ${poster.msg_count} / ${poster.msg_count_root} / ${poster.mention_count}`,
    );
    const i = await check();
    out(`(i) unviewed plain post: ${i.problem ?? 'accepted'}`);
    expectThat(
        '(i) a genuinely unread channel is rejected with the unread error',
        i.problem === 'read-back: live not viewed clean (unread mentions 0, unread msgs 2)',
    );
    await view(a, live.id);
    const ii = await check();
    out(`(ii) after A views: ${ii.problem ?? 'accepted'}`);
    expectThat('(ii) the same channel is accepted after the view', ii.problem === null);
    out(
        `(iii) member msg/root ${ii.member.msg_count} / ${ii.member.msg_count_root}, unread msg/root/mention ${ii.unread.msg_count} / ${ii.unread.msg_count_root} / ${ii.unread.mention_count}`,
    );
    expectThat(
        '(iii) member counters nonzero (== total) with unread 0 is accepted',
        ii.member.msg_count > 0 && ii.member.msg_count_root > 0 && ii.problem === null,
    );
    await setMarkUnread(a, live.id, 'mention');
    await post(b, live.id, 'diagnostic plain text two');
    const iv = await check();
    out(
        `(iv) mentions-only, unviewed plain post: unread msg/root ${iv.unread.msg_count} / ${iv.unread.msg_count_root}; ${iv.problem ?? 'accepted'}`,
    );
    expectThat(
        '(iv) mentions-only cannot mask the unread post: the read-back refuses it',
        iv.problem === "read-back: live mark_unread is 'mention' (unread msgs would be masked)",
    );
    await setMarkUnread(a, live.id, 'all');
    const ivAll = await check();
    out(`(iv) restored to all: ${ivAll.problem ?? 'accepted'}`);
    expectThat(
        '(iv) restored to all, the unread post is reported',
        ivAll.problem === 'read-back: live not viewed clean (unread mentions 0, unread msgs 2)',
    );
    await view(a, live.id);
    expectThat('(iv) accepted after the view', (await check()).problem === null);

    return checks.every(Boolean);
}

let ok = false;
try {
    ok = await main();
} catch (err) {
    out(`DIAG FAIL (${scrubIds(err.message)})`);
}
out(`DIAG: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(Boolean).length}/${checks.length})`);
process.exitCode = ok ? 0 : 1;
