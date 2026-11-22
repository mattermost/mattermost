#!/usr/bin/env node
// FIXTURE VALIDATION, not the measured benchmark. Read-only probe of the MM-71128 data path on the live stack:
// a message attachment with three fields is posted as the seeded regular member and read back over REST.
// Nothing is rendered or explored. The default seed is not altered; only the scratch channel qa-probe-polls
// (created through the admin API when missing) and one post in it are added.
//   node probe_attachment_fields.mjs        (PW_BASE_URL defaults to the pilot base URL)
// Prints the server version/build, the Mattermost Blocks flag, and whether all three field titles come back.
// Never prints ids. Exit 0 when the posted fields are read back intact, 1 otherwise.
import crypto from 'node:crypto';

import {Api, QA_USER_PASSWORD, adminApi, expectedState, login} from './api.mjs';

const SCRATCH_CHANNEL = 'qa-probe-polls';
const FIELDS = [
    {title: 'Apple (3 votes)', value: '', short: true},
    {title: 'Pear (0 votes)', value: '', short: true},
    {title: 'Control', value: 'present', short: false},
];
const ATTACHMENT = {title: 'Probe poll', text: 'Fixture validation attachment', fields: FIELDS};

const line = (key, value) => process.stdout.write(`${key}: ${value}\n`);
const scrubIds = (text) => String(text).replace(/\b[a-z0-9]{26}\b/g, '<id>');

async function ensureScratchChannel(admin, teamId, userId) {
    const path = `/teams/${teamId}/channels/name/${SCRATCH_CHANNEL}`;
    const found = await admin.req('GET', path, undefined, {allow: [404]});
    let channel = found.body;
    if (found.status === 404) {
        const spec = {team_id: teamId, name: SCRATCH_CHANNEL, display_name: 'QA Probe Polls', type: 'O'};
        channel = (await admin.req('POST', '/channels', spec)).body;
    }
    await admin.req('POST', `/channels/${channel.id}/members`, {user_id: userId});
    return channel;
}

function fieldsIntact(fields) {
    if (!Array.isArray(fields) || fields.length !== FIELDS.length) {
        return false;
    }
    return FIELDS.every((f, i) => {
        const got = fields[i];
        return got.title === f.title && got.value === f.value && Boolean(got.short) === f.short;
    });
}

function shortDigest(value) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(value ?? null));
    return hash.digest('hex').slice(0, 12);
}

async function main() {
    const {team, user} = expectedState('default');
    const admin = await adminApi();
    const teamBody = (await admin.req('GET', `/teams/name/${team.name}`)).body;
    const userBody = (await admin.req('GET', `/users/username/${user.username}`)).body;
    const channel = await ensureScratchChannel(admin, teamBody.id, userBody.id);

    const session = await login(user.username, QA_USER_PASSWORD);
    if (!session) {
        throw new Error(`${user.username} cannot log in`);
    }
    const member = new Api(session.token);

    line('purpose', 'FIXTURE VALIDATION (not the measured benchmark)');
    const post = {
        channel_id: channel.id,
        message: 'Fixture validation: attachment fields probe',
        props: {attachments: [ATTACHMENT]},
    };
    const created = (await member.req('POST', '/posts', post)).body;
    const stored = (await member.req('GET', `/posts/${created.id}`)).body;
    const attachments = stored.props?.attachments;
    const fields = Array.isArray(attachments) ? attachments[0]?.fields : undefined;
    const titles = Array.isArray(fields) ? fields.map((f) => f.title) : [];
    const allTitles = FIELDS.every((f) => titles.includes(f.title));
    const intact = fieldsIntact(fields);
    const digest = shortDigest(attachments);

    const client = (await member.req('GET', '/config/client?format=old')).body;

    line('post.attachments.length', Array.isArray(attachments) ? attachments.length : 'missing');
    line('post.attachments[0].fields.length', Array.isArray(fields) ? fields.length : 'missing');
    for (const f of FIELDS) {
        line(`post.field.${JSON.stringify(f.title)}`, titles.includes(f.title) ? 'present' : 'MISSING');
    }
    line('post.fields.all_three_titles', allTitles ? 'PASS' : 'FAIL');
    line('post.fields.values_and_short_intact', intact ? 'PASS' : 'FAIL');
    line('post.attachments.sha256_12', digest);
    line('config.FeatureFlagMmBlocksEnabled', client.FeatureFlagMmBlocksEnabled ?? 'absent');
    line('server.Version', client.Version ?? 'absent');
    line('server.BuildHash', client.BuildHash ?? 'absent');
    line('server.BuildEnterpriseReady', client.BuildEnterpriseReady ?? 'absent');
    line('PROBE', allTitles && intact ? 'PASS' : 'FAIL');
    return allTitles && intact;
}

let ok = false;
try {
    ok = await main();
} catch (e) {
    line('PROBE', `FAIL (${scrubIds(e.message)})`);
}
process.exitCode = ok ? 0 : 1;
