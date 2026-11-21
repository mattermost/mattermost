// Shared helpers for seed.mjs / verify_seed.mjs. Built-ins only.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const INFRA_DIR = path.resolve(SCRIPTS_DIR, '..');
export const SCENARIOS_PATH = path.resolve(INFRA_DIR, '..', 'scenarios.json');
export const MANIFEST_PATH = path.join(INFRA_DIR, '.run', 'seed-manifest.json');
export const BOOKMARKS_CHARTER_PATH = path.resolve(INFRA_DIR, '..', 'sessions', 'bookmarks', 'charter.json');

export const BASE_URL = (process.env.PW_BASE_URL || 'http://127.0.0.1:8065').replace(/\/+$/, '');
export const ADMIN = {
    username: process.env.PW_ADMIN_USERNAME || 'sysadmin',
    password: process.env.PW_ADMIN_PASSWORD || 'Sys@dmin-sample1',
    email: process.env.PW_ADMIN_EMAIL || 'sysadmin@sample.mattermost.com',
};

// Synthetic credentials for the pilot's signed-in user (not a secret).
export const QA_USER_PASSWORD = 'QaUser-synthetic-7f3c!';
export const QA_USER_EMAIL = 'qa-user@sample.mattermost.com';

export const VARIANTS = ['default', 'swap-purpose-header', 'no-archive'];
export const SWAPPED_CHANNELS = ['qa-sandbox', 'release-planning'];

export function parseVariant(argv) {
    const arg = argv.find((a) => a.startsWith('--variant='));
    const variant = arg ? arg.slice('--variant='.length) : 'default';
    if (!VARIANTS.includes(variant)) {
        throw new Error(`unknown variant "${variant}" (expected one of: ${VARIANTS.join(', ')})`);
    }
    return variant;
}

// Returns null when --session is absent, so callers keep their default behaviour.
export function parseSession(argv, allowed) {
    const arg = argv.find((a) => a.startsWith('--session='));
    if (!arg) {
        return null;
    }
    const session = arg.slice('--session='.length);
    if (!allowed.includes(session)) {
        throw new Error(`unknown session "${session}" (expected one of: ${allowed.join(', ')})`);
    }
    return session;
}

export function parseFlag(argv, name) {
    const arg = argv.find((a) => a.startsWith(`--${name}=`));
    return arg ? arg.slice(name.length + 3) : null;
}

// Bookmarks from the session charter's fixture_setup. link_url is built at seed time from BASE_URL.
export function bookmarkSpecs(teamName) {
    const charter = JSON.parse(fs.readFileSync(BOOKMARKS_CHARTER_PATH, 'utf8'));
    const list = charter.fixture_setup?.bookmarks;
    if (!Array.isArray(list) || list.length === 0) {
        throw new Error('bookmarks charter: fixture_setup.bookmarks missing');
    }
    return list.map((b) => {
        const urlPath = `/${teamName}/channels/${b.channel}`;
        if (typeof b.channel !== 'string' || typeof b.display_name !== 'string' || !b.display_name) {
            throw new Error('bookmarks charter: bookmark needs channel and display_name');
        }
        if (b.type !== 'link' || b.link_url !== `<manifest base_url>${urlPath}`) {
            throw new Error(`bookmarks charter: ${b.channel} must be a link to its own channel path`);
        }
        if (!/^none\b/.test(b.emoji || 'none') || !/^none\b/.test(b.image_url || 'none')) {
            throw new Error(`bookmarks charter: ${b.channel} must declare no emoji and no image_url`);
        }
        return {channel: b.channel, display_name: b.display_name, type: 'link', url_path: urlPath, link_url: `${BASE_URL}${urlPath}`};
    });
}

// Same four preferences as lib/src/server/user.ts setDefaultOnboardingPreferences.
export function onboardingPreferences(userId) {
    return [
        {user_id: userId, category: 'tutorial_step', name: userId, value: '999'},
        {user_id: userId, category: 'crt_thread_pane_step', name: userId, value: '999'},
        {user_id: userId, category: 'onboarding_task_list', name: 'onboarding_task_list_show', value: 'false'},
        {user_id: userId, category: 'onboarding_task_list', name: 'onboarding_task_list_open', value: 'false'},
    ];
}

// Reads team, qa-user and channels from the PILOT-01 / PILOT-02 fixture_setup sections and applies the variant.
export function expectedState(variant) {
    const scenarios = JSON.parse(fs.readFileSync(SCENARIOS_PATH, 'utf8')).scenarios;
    const fixture = (id) => {
        const s = scenarios.find((x) => x.id === id);
        if (!s?.fixture_setup) {
            throw new Error(`scenarios.json: missing ${id}.fixture_setup`);
        }
        return s.fixture_setup;
    };
    const p1 = fixture('PILOT-01');
    const p2 = fixture('PILOT-02');

    const team = p1.team;
    const qaUser = p1.users.find((u) => u.username === 'qa-user');
    if (!team?.name || !team.display_name || !qaUser) {
        throw new Error('scenarios.json: PILOT-01 team or qa-user missing');
    }

    const channels = [...p1.channels, ...p2.channels].map((c) => {
        for (const key of ['name', 'display_name', 'type', 'purpose', 'header']) {
            if (typeof c[key] !== 'string') {
                throw new Error(`scenarios.json: channel ${c.name} missing ${key}`);
            }
        }
        return {
            name: c.name,
            display_name: c.display_name,
            type: c.type,
            purpose: c.purpose,
            header: c.header,
            archived: c.archived === true && variant !== 'no-archive',
        };
    });

    if (variant === 'swap-purpose-header') {
        const [a, b] = SWAPPED_CHANNELS.map((n) => channels.find((c) => c.name === n));
        [a.purpose, b.purpose] = [b.purpose, a.purpose];
        [a.header, b.header] = [b.header, a.header];
    }

    // View order from PILOT-01 ordering_requirements: release-planning, then qa-sandbox.
    const viewOrder = ['release-planning', 'qa-sandbox'];

    return {
        variant,
        team: {name: team.name, display_name: team.display_name, type: team.type || 'O'},
        user: {username: qaUser.username, email: QA_USER_EMAIL, password: QA_USER_PASSWORD},
        channels,
        viewOrder,
    };
}

export class Api {
    constructor(token = '') {
        this.token = token;
    }

    // Returns {status, body}; throws on unexpected status with only method, path, status and server error id.
    // anyStatus: never throw on status; the caller judges it.
    async req(method, urlPath, body, {ok = [200, 201], allow = [], anyStatus = false} = {}) {
        const headers = {'X-Requested-With': 'XMLHttpRequest'};
        if (this.token) {
            headers.Authorization = `Bearer ${this.token}`;
        }
        if (body !== undefined) {
            headers['Content-Type'] = 'application/json';
        }
        const res = await fetch(`${BASE_URL}/api/v4${urlPath}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(15000),
        });
        let parsed = null;
        try {
            parsed = await res.json();
        } catch {
            parsed = null;
        }
        if (!anyStatus && !ok.includes(res.status) && !allow.includes(res.status)) {
            throw new Error(`${method} ${urlPath} -> ${res.status} ${parsed?.id || ''}`.trim());
        }
        return {status: res.status, body: parsed, headers: res.headers};
    }
}

// Bookmark API errors never echo response bodies; 501 means the server has no license.
export function bookmarkSetupFailure(what, status) {
    const hint = status === 501 ? ' (501: server not licensed)' : '';
    return new Error(`setup failure: licence/bookmarks: ${what} -> HTTP ${status}${hint}`);
}

// Non-deleted bookmarks of a channel (GET /channels/{id}/bookmarks), or a setup failure.
export async function listBookmarks(api, channelId, label) {
    const res = await api.req('GET', `/channels/${channelId}/bookmarks`, undefined, {anyStatus: true});
    if (res.status !== 200 || !Array.isArray(res.body)) {
        throw bookmarkSetupFailure(`GET bookmarks of ${label}`, res.status);
    }
    return res.body.filter((b) => b && b.delete_at === 0);
}

export function readManifest() {
    try {
        return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    } catch {
        return null;
    }
}

export async function login(username, password) {
    const {status, headers, body} = await new Api().req(
        'POST',
        '/users/login',
        {login_id: username, password},
        {allow: [401]},
    );
    return status === 200 ? {token: headers.get('token'), user: body} : null;
}

// Mirrors lib/src/global_setup.ts baseGlobalSetup: create the first user (becomes system admin) only if login fails.
export async function adminApi() {
    let session = await login(ADMIN.username, ADMIN.password);
    if (!session) {
        await new Api().req('POST', '/users', ADMIN, {allow: [400, 403]});
        session = await login(ADMIN.username, ADMIN.password);
    }
    if (!session) {
        throw new Error(`admin ${ADMIN.username} cannot log in and could not be created`);
    }
    if (!session.user.roles.split(' ').includes('system_admin')) {
        throw new Error(`${ADMIN.username} is not a system admin`);
    }
    return new Api(session.token);
}
