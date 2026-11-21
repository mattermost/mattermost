// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-process-env -- the admin identity defaults mirror infra/scripts/api.mjs */

// The seeded bookmarks fixture: what the charter declares, what the seed manifest says, and a cheap live probe.
// Ids are never printed or stored; only a sha256 fingerprint of the bookmark ids leaves this module.
import fs from 'node:fs';

import {readJson, sha256Json} from '../common.mjs';
import {infraPaths, sessionCharterPath} from '../infra.mjs';

const PROBE_TIMEOUT_MS = 10000;

export function loadCharter(session) {
    return readJson(sessionCharterPath(session));
}

/** [{channel, display_name}] declared by the charter's fixture_setup.bookmarks. */
export function declaredBookmarks(charter) {
    const list = charter.fixture_setup?.bookmarks;
    if (!Array.isArray(list) || list.length === 0) {
        throw new Error('the session charter declares no fixture_setup.bookmarks');
    }
    return list.map((b) => ({channel: b.channel, display_name: b.display_name}));
}

export function readManifest() {
    const {manifest} = infraPaths();
    return fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, 'utf8')) : null;
}

/** sha256 of the canonical {channel: bookmark id} map: equal fingerprints mean the same bookmarks, with the same ids. */
export function fingerprintOf(idsByChannel) {
    return sha256Json(Object.fromEntries(Object.entries(idsByChannel).sort(([a], [b]) => (a < b ? -1 : 1))));
}

/**
 * Reads infra/.run/seed-manifest.json (never printed): the session key must name the selection and hold one bookmark
 * entry per declared channel with the declared title. Returns {ok, failures: [code], fingerprint, titles}.
 */
export function checkManifestSession(manifest, session, declared) {
    const failures = [];
    if (!manifest) {
        return {ok: false, failures: ['manifest_missing'], fingerprint: null, titles: {}};
    }
    if (manifest.session?.name !== session) {
        failures.push('session_name_missing_or_different');
    }
    const ids = {};
    const titles = {};
    for (const {channel, display_name: title} of declared) {
        const entry = manifest.session?.bookmarks?.[channel];
        if (!entry || typeof entry.id !== 'string' || entry.id === '') {
            failures.push(`bookmark_entry_missing:${channel}`);
            continue;
        }
        ids[channel] = entry.id;
        titles[channel] = entry.display_name;
        if (entry.display_name !== title) {
            failures.push(`bookmark_title_differs:${channel}`);
        }
        if (typeof manifest.channels?.[channel]?.id !== 'string') {
            failures.push(`channel_entry_missing:${channel}`);
        }
    }
    const complete = declared.every((d) => ids[d.channel]);
    return {
        ok: failures.length === 0,
        failures,
        fingerprint: complete ? fingerprintOf(ids) : null,
        titles,
    };
}

async function getJson(url, init = {}) {
    const res = await fetch(url, {...init, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)});
    let body = null;
    try {
        body = await res.json();
    } catch {
        body = null;
    }
    return {res, body};
}

/**
 * Cheap live probe through the seeding admin's reads only: each declared channel holds exactly one non-deleted bookmark
 * with the declared title and the id the manifest names, and the fingerprint of the live ids equals the expected one.
 * Writes nothing. Returns {ok, reason, fingerprint}; reason is a code, never a URL or an id.
 */
export async function probeFixture({manifest, declared, expectedFingerprint, titles}) {
    const base = String(manifest?.base_url ?? '').replace(/\/+$/, '');
    let host;
    try {
        host = new URL(base).hostname;
    } catch {
        return {ok: false, reason: 'base_url_invalid', fingerprint: null};
    }
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) {
        return {ok: false, reason: 'base_url_not_loopback', fingerprint: null};
    }
    const admin = {
        username: process.env.PW_ADMIN_USERNAME || 'sysadmin',
        password: process.env.PW_ADMIN_PASSWORD || 'Sys@dmin-sample1',
    };
    const ids = {};
    try {
        const login = await getJson(`${base}/api/v4/users/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest'},
            body: JSON.stringify({login_id: admin.username, password: admin.password}),
        });
        const token = login.res.ok ? login.res.headers.get('token') : null;
        if (!token) {
            return {ok: false, reason: 'admin_login_failed', fingerprint: null};
        }
        for (const {channel, display_name: declaredTitle} of declared) {
            const channelId = manifest.channels?.[channel]?.id;
            const wanted = titles?.[channel] ?? declaredTitle;
            const list = await getJson(`${base}/api/v4/channels/${channelId}/bookmarks`, {
                headers: {Authorization: `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest'},
            });
            if (list.res.status !== 200 || !Array.isArray(list.body)) {
                return {ok: false, reason: `bookmark_read_failed:${channel}`, fingerprint: null};
            }
            const live = list.body.filter((b) => b && !b.delete_at);
            if (live.length !== 1) {
                return {ok: false, reason: `bookmark_count_differs:${channel}`, fingerprint: null};
            }
            if (live[0].display_name !== wanted) {
                return {ok: false, reason: `bookmark_title_differs:${channel}`, fingerprint: null};
            }
            if (live[0].id !== manifest.session?.bookmarks?.[channel]?.id) {
                return {ok: false, reason: `bookmark_id_differs_from_manifest:${channel}`, fingerprint: null};
            }
            ids[channel] = live[0].id;
        }
    } catch {
        return {ok: false, reason: 'server_unreachable', fingerprint: null};
    }
    const fingerprint = fingerprintOf(ids);
    if (expectedFingerprint && fingerprint !== expectedFingerprint) {
        return {ok: false, reason: 'fingerprint_differs', fingerprint};
    }
    return {ok: true, reason: 'ok', fingerprint};
}
