// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import crypto from 'node:crypto';
import http from 'node:http';

// A loopback stand-in for the app, used only by journey_selftest.pw.ts: the REST routes the journey fixture
// factory, read-back and lib login call, plus server-rendered pages. It knows nothing about any charter; a
// post's `props.tally` is rendered as a heading, a note and one "<label> =" row per item.

export type RenderMode =
    | 'complete'
    // rows with an empty count are dropped in the room view; the overview page always renders every row
    | 'drop-empty'
    // the post never renders anywhere
    | 'hidden'
    // the whole post is inserted `delayMs` after load
    | 'delayed-post'
    // heading, note and filled rows at once; empty-count rows `delayMs` after load
    | 'delayed-rows'
    // only the first team to open the room sees 'drop-empty'; every later team sees 'complete'
    | 'drop-empty-first-team-only'
    // empty-count rows are rendered aria-hidden (DOM only, absent from the accessibility tree)
    | 'rows-dom-only';

export type AppVariant = {
    render: RenderMode;
    delayMs?: number;
    /** Text with every row label placed in the sidebar, outside any post. */
    decoyInSidebar?: boolean;
    clientConfig?: Record<string, string>;
    postStatus?: number;
    /** Stores the post with its last item dropped (the read-back must catch it). */
    corruptStoredPost?: boolean;
};

type User = {id: string; username: string; password: string; email: string; first_name: string; last_name: string};
// Mirrors the server: msg_count/msg_count_root are the member's read cursor (the channel totals at its last
// view); the unread endpoint reports totals minus the cursor, or 0 msgs under mark_unread 'mention'.
type MemberState = {
    msg_count: number;
    msg_count_root: number;
    mention_count: number;
    mention_count_root: number;
    notify_props: Record<string, string>;
};
type Post = {
    id: string;
    channel_id: string;
    user_id: string;
    message: string;
    type: string;
    props: Record<string, unknown>;
    create_at: number;
};

const ADMIN = {username: 'selftest-admin', password: 'Selftest-admin-1'};

function newId(): string {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return [...crypto.randomBytes(26)].map((b) => alphabet[b % alphabet.length]).join('');
}

function escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]!);
}

export class SelftestApp {
    variant: AppVariant = {render: 'complete'};
    readonly users = new Map<string, User>();
    readonly tokens = new Map<string, string>();
    readonly teams = new Map<string, {id: string; name: string; display_name: string; type: string}>();
    readonly teamMembers = new Set<string>();
    readonly channels = new Map<
        string,
        {
            id: string;
            team_id: string;
            name: string;
            display_name: string;
            type: string;
            total_msg_count: number;
            total_msg_count_root: number;
        }
    >();
    readonly channelMembers = new Map<string, Set<string>>();
    readonly memberStates = new Map<string, MemberState>();
    readonly preferences = new Map<string, Array<Record<string, string>>>();
    readonly posts = new Map<string, Post>();
    readonly firstTeamThatOpenedRoom: string[] = [];
    requests = 0;
    private server: http.Server | null = null;

    reset(variant: AppVariant) {
        this.variant = variant;
        for (const map of [
            this.users,
            this.tokens,
            this.teams,
            this.channels,
            this.channelMembers,
            this.memberStates,
            this.preferences,
            this.posts,
        ]) {
            map.clear();
        }
        this.teamMembers.clear();
        this.firstTeamThatOpenedRoom.length = 0;
        this.requests = 0;
        const admin: User = {id: newId(), ...ADMIN, email: 'admin@selftest.invalid', first_name: '', last_name: ''};
        this.users.set(admin.id, admin);
    }

    get adminCredentials() {
        return {...ADMIN};
    }

    async listen(port: number): Promise<void> {
        this.reset(this.variant);
        this.server = http.createServer((req, res) => {
            this.requests++;
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', () => {
                try {
                    this.handle(req, res, body);
                } catch {
                    this.json(res, 500, {message: 'selftest app error'});
                }
            });
        });
        await new Promise<void>((resolve) => this.server!.listen(port, '127.0.0.1', resolve));
    }

    async close(): Promise<void> {
        await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
    }

    private json(res: http.ServerResponse, status: number, data: unknown, headers: Record<string, string> = {}) {
        res.writeHead(status, {'Content-Type': 'application/json', ...headers});
        res.end(JSON.stringify(data));
    }

    private userFor(req: http.IncomingMessage): User | null {
        const auth = /^Bearer (\S+)$/i.exec(req.headers.authorization ?? '')?.[1];
        const cookie = /(?:^|;\s*)MMAUTHTOKEN=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
        const userId = this.tokens.get(auth ?? cookie ?? '');
        return userId ? (this.users.get(userId) ?? null) : null;
    }

    private publicUser(u: User) {
        return {
            id: u.id,
            username: u.username,
            email: u.email,
            first_name: u.first_name,
            last_name: u.last_name,
            roles: 'system_user',
        };
    }

    private handle(req: http.IncomingMessage, res: http.ServerResponse, raw: string) {
        const url = new URL(req.url ?? '/', 'http://selftest.invalid');
        const method = req.method ?? 'GET';
        const p = url.pathname;
        const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        if (p.startsWith('/api/v4/')) {
            this.api(req, res, method, p.slice('/api/v4'.length), body);
            return;
        }
        this.page(req, res, p);
    }

    private api(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        method: string,
        p: string,
        body: Record<string, unknown>,
    ) {
        let m: RegExpExecArray | null;
        if (method === 'GET' && p === '/config/client') {
            this.json(res, 200, {
                Version: '0.0.0-selftest',
                BuildHash: 'selftest-build',
                FeatureFlagRibbonTally: 'true',
                ...(this.variant.clientConfig ?? {}),
            });
            return;
        }
        if (method === 'POST' && p === '/users/login') {
            const user = [...this.users.values()].find(
                (u) => u.username === body.login_id && u.password === body.password,
            );
            if (!user) {
                this.json(res, 401, {message: 'invalid login'});
                return;
            }
            const token = newId();
            this.tokens.set(token, user.id);
            this.json(res, 200, this.publicUser(user), {
                Token: token,
                'Set-Cookie': `MMAUTHTOKEN=${token}; Path=/; HttpOnly`,
            });
            return;
        }
        const me = this.userFor(req);
        if (!me) {
            this.json(res, 401, {message: 'not signed in'});
            return;
        }
        if (method === 'POST' && p === '/users') {
            const user: User = {
                id: newId(),
                username: String(body.username),
                password: String(body.password),
                email: String(body.email),
                first_name: String(body.first_name ?? ''),
                last_name: String(body.last_name ?? ''),
            };
            this.users.set(user.id, user);
            this.json(res, 201, this.publicUser(user));
            return;
        }
        if (method === 'POST' && p === '/teams') {
            const team = {
                id: newId(),
                name: String(body.name),
                display_name: String(body.display_name),
                type: String(body.type),
            };
            this.teams.set(team.id, team);
            this.json(res, 201, team);
            return;
        }
        if (method === 'POST' && (m = /^\/teams\/(\w+)\/members$/.exec(p))) {
            this.teamMembers.add(`${m[1]}:${String(body.user_id)}`);
            this.json(res, 201, {team_id: m[1], user_id: body.user_id});
            return;
        }
        if (method === 'POST' && p === '/channels') {
            const channel = {
                id: newId(),
                team_id: String(body.team_id),
                name: String(body.name),
                display_name: String(body.display_name),
                type: String(body.type),
                total_msg_count: 0,
                total_msg_count_root: 0,
            };
            this.channels.set(channel.id, channel);
            this.channelMembers.set(channel.id, new Set());
            this.json(res, 201, channel);
            return;
        }
        if (method === 'GET' && (m = /^\/channels\/(\w+)$/.exec(p))) {
            const channel = this.channels.get(m[1]);
            this.json(res, channel ? 200 : 404, channel ?? {message: 'no channel'});
            return;
        }
        if (method === 'POST' && p === '/channels/members/me/view') {
            this.markViewed(String(body.channel_id), me.id);
            this.json(res, 200, {status: 'OK'});
            return;
        }
        if (method === 'PUT' && (m = /^\/channels\/(\w+)\/members\/(\w+)\/notify_props$/.exec(p))) {
            const state = this.memberStates.get(`${m[1]}:${m[2]}`);
            if (!state || m[2] !== me.id) {
                this.json(res, state ? 403 : 404, {message: 'no member'});
                return;
            }
            for (const [key, value] of Object.entries(body)) {
                if (key !== 'channel_id' && key !== 'user_id') {
                    state.notify_props[key] = String(value);
                }
            }
            this.json(res, 200, {status: 'OK'});
            return;
        }
        if (method === 'GET' && (m = /^\/users\/(\w+)\/channels\/(\w+)\/unread$/.exec(p))) {
            const state = this.memberStates.get(`${m[2]}:${m[1]}`);
            const channel = this.channels.get(m[2]);
            if (!state || !channel) {
                this.json(res, 404, {message: 'no member'});
                return;
            }
            const masked = state.notify_props.mark_unread === 'mention';
            this.json(res, 200, {
                team_id: channel.team_id,
                channel_id: channel.id,
                msg_count: masked ? 0 : channel.total_msg_count - state.msg_count,
                msg_count_root: masked ? 0 : channel.total_msg_count_root - state.msg_count_root,
                mention_count: state.mention_count,
                mention_count_root: state.mention_count_root,
                notify_props: {...state.notify_props},
            });
            return;
        }
        if ((m = /^\/channels\/(\w+)\/members$/.exec(p))) {
            const members = this.channelMembers.get(m[1]);
            if (!members) {
                this.json(res, 404, {message: 'no channel'});
                return;
            }
            if (method === 'POST') {
                const userId = String(body.user_id);
                if (!members.has(userId)) {
                    members.add(userId);
                    // Join system posts stay out of the totals; an "added to the channel" post mentions the added user.
                    const addedByOther = userId !== me.id;
                    this.memberStates.set(`${m[1]}:${userId}`, {
                        msg_count: 0,
                        msg_count_root: 0,
                        mention_count: addedByOther ? 1 : 0,
                        mention_count_root: addedByOther ? 1 : 0,
                        notify_props: {mark_unread: 'all'},
                    });
                }
                this.json(res, 201, {channel_id: m[1], user_id: body.user_id});
                return;
            }
            this.json(
                res,
                200,
                [...members].map((u) => this.member(m![1], u)),
            );
            return;
        }
        if (method === 'GET' && (m = /^\/channels\/(\w+)\/members\/(\w+)$/.exec(p))) {
            this.json(res, 200, this.member(m[1], m[2]));
            return;
        }
        if (method === 'GET' && (m = /^\/channels\/(\w+)\/posts$/.exec(p))) {
            const posts = [...this.posts.values()].filter((x) => x.channel_id === m![1]);
            this.json(res, 200, {
                order: posts.map((x) => x.id),
                posts: Object.fromEntries(posts.map((x) => [x.id, x])),
            });
            return;
        }
        if ((m = /^\/users\/(\w+)\/preferences$/.exec(p))) {
            if (method === 'PUT') {
                this.preferences.set(m[1], [
                    ...(this.preferences.get(m[1]) ?? []),
                    ...(body as unknown as Array<Record<string, string>>),
                ]);
                this.json(res, 200, {status: 'OK'});
                return;
            }
            this.json(res, 200, this.preferences.get(m[1]) ?? []);
            return;
        }
        if (method === 'POST' && p === '/posts') {
            if (this.variant.postStatus) {
                this.json(res, this.variant.postStatus, {message: 'rejected by the selftest variant'});
                return;
            }
            const props = structuredClone((body.props ?? {}) as Record<string, unknown>);
            if (this.variant.corruptStoredPost) {
                const tally = props.tally as {items?: unknown[]} | undefined;
                tally?.items?.pop();
            }
            const post: Post = {
                id: newId(),
                channel_id: String(body.channel_id),
                user_id: me.id,
                message: String(body.message ?? ''),
                type: '',
                props,
                create_at: Date.now(),
            };
            this.posts.set(post.id, post);
            const channel = this.channels.get(post.channel_id);
            if (channel) {
                channel.total_msg_count++;
                channel.total_msg_count_root++;
                for (const userId of this.channelMembers.get(channel.id) ?? []) {
                    const username = this.users.get(userId)?.username;
                    if (userId !== me.id && username && post.message.includes(`@${username}`)) {
                        const state = this.memberStates.get(`${channel.id}:${userId}`)!;
                        state.mention_count++;
                        state.mention_count_root++;
                    }
                }
                // A root post marks the channel viewed for its author.
                this.markViewed(channel.id, me.id);
            }
            this.json(res, 201, post);
            return;
        }
        if (method === 'GET' && (m = /^\/posts\/(\w+)$/.exec(p))) {
            const post = this.posts.get(m[1]);
            this.json(res, post ? 200 : 404, post ?? {message: 'no post'});
            return;
        }
        this.json(res, 404, {message: `selftest app has no route ${method} ${p}`});
    }

    private markViewed(channelId: string, userId: string) {
        const state = this.memberStates.get(`${channelId}:${userId}`);
        const channel = this.channels.get(channelId);
        if (state && channel) {
            state.msg_count = channel.total_msg_count;
            state.msg_count_root = channel.total_msg_count_root;
            state.mention_count = 0;
            state.mention_count_root = 0;
        }
    }

    private member(channelId: string, userId: string) {
        const state = this.memberStates.get(`${channelId}:${userId}`);
        return {
            channel_id: channelId,
            user_id: userId,
            ...structuredClone(state ?? {msg_count: 0, msg_count_root: 0, mention_count: 0, mention_count_root: 0}),
            notify_props: {...(state?.notify_props ?? {})},
        };
    }

    private renderPost(post: Post, mode: RenderMode, delayMs: number): string {
        const tally = (post.props.tally ?? null) as {
            heading: string;
            note: string;
            items: Array<{label: string; count: string}>;
        } | null;
        const parts = [`<p>${escapeHtml(post.message)}</p>`];
        if (!tally) {
            return `<li>${parts.join('')}</li>`;
        }
        const row = (item: {label: string; count: string}, hidden = false) =>
            `<p${hidden ? ' aria-hidden="true"' : ''}><b>${escapeHtml(item.label)} =</b>${item.count ? ` <span>${escapeHtml(item.count)}</span>` : ''}</p>`;
        const head = `<strong>${escapeHtml(tally.heading)}</strong><p>${escapeHtml(tally.note)}</p>`;
        const filled = tally.items
            .filter((i) => i.count)
            .map((i) => row(i))
            .join('');
        const empty = tally.items
            .filter((i) => !i.count)
            .map((i) => row(i))
            .join('');
        const later = (html: string) =>
            `<span id="later-${post.id}"></span><script>setTimeout(() => { document.getElementById('later-${post.id}').outerHTML = ${JSON.stringify(html)}; }, ${delayMs});</script>`;
        switch (mode) {
            case 'hidden':
                return '';
            case 'drop-empty':
                return `<li>${parts.join('')}<div>${head}${filled}</div></li>`;
            case 'delayed-post':
                return `<li>${parts.join('')}${later(`<div>${head}${empty}${filled}</div>`)}</li>`;
            case 'delayed-rows':
                return `<li>${parts.join('')}<div>${head}${filled}${later(empty)}</div></li>`;
            case 'rows-dom-only':
                return `<li>${parts.join('')}<div>${head}${tally.items
                    .filter((i) => !i.count)
                    .map((i) => row(i, true))
                    .join('')}${filled}</div></li>`;
            default:
                return `<li>${parts.join('')}<div>${head}${empty}${filled}</div></li>`;
        }
    }

    private page(req: http.IncomingMessage, res: http.ServerResponse, p: string) {
        const me = this.userFor(req);
        const m = /^\/([\w-]+)\/(?:channels\/([\w-]+)|(overview))$/.exec(p);
        const team = m ? [...this.teams.values()].find((t) => t.name === m[1]) : undefined;
        if (!me || !team) {
            res.writeHead(404, {'Content-Type': 'text/html'});
            res.end('<html><body><main><h1>Not found</h1></main></body></html>');
            return;
        }
        const rooms = [...this.channels.values()]
            .filter((c) => c.team_id === team.id && this.channelMembers.get(c.id)?.has(me.id))
            .sort((a, b) => (a.display_name < b.display_name ? -1 : 1));
        const links = rooms
            .map((c) => `<li><a href="/${team.name}/channels/${c.name}">${escapeHtml(c.display_name)}</a></li>`)
            .concat(`<li><a href="/${team.name}/overview">Overview</a></li>`)
            .join('');
        const decoy = this.variant.decoyInSidebar
            ? `<p>${[...this.posts.values()]
                  .flatMap((x) =>
                      ((x.props.tally as {items?: Array<{label: string}>})?.items ?? []).map(
                          (i) => `${escapeHtml(i.label)} =`,
                      ),
                  )
                  .join(' ')}</p>`
            : '';
        let title: string;
        let posts: Post[];
        let mode = this.variant.render;
        if (m![3]) {
            title = 'Overview';
            posts = [...this.posts.values()].filter((x) => rooms.some((c) => c.id === x.channel_id));
            if (mode !== 'hidden') {
                mode = 'complete';
            }
        } else {
            const room = rooms.find((c) => c.name === m![2]);
            if (!room) {
                res.writeHead(404, {'Content-Type': 'text/html'});
                res.end('<html><body><main><h1>Not found</h1></main></body></html>');
                return;
            }
            title = room.display_name;
            posts = [...this.posts.values()].filter((x) => x.channel_id === room.id);
            if (mode === 'drop-empty-first-team-only') {
                if (posts.length && this.firstTeamThatOpenedRoom.length === 0) {
                    this.firstTeamThatOpenedRoom.push(team.id);
                }
                mode = this.firstTeamThatOpenedRoom[0] === team.id ? 'drop-empty' : 'complete';
            }
        }
        const items = posts
            .sort((a, b) => a.create_at - b.create_at)
            .map((x) => this.renderPost(x, mode, this.variant.delayMs ?? 0))
            .join('');
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(
            `<!doctype html><html><head><title>${escapeHtml(title)}</title></head><body>` +
                `<nav aria-label="channel sidebar"><ul>${links}</ul>${decoy}<button type="button">Sign out</button></nav>` +
                `<main><h1>${escapeHtml(title)}</h1><ul aria-label="messages">${items}</ul></main></body></html>`,
        );
    }
}
