// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * HTTP mock of a peer Mattermost server's `/api/v4/remotecluster/*` endpoints, with:
 * - Per-request queues so the **next** inbound `confirm_invite`, shared-channel invite (`/msg` topic
 *   `sharedchannel_invite`), or other `/msg` can succeed or fail.
 * - Outbound helpers to **push** frames from the mock to your real Mattermost server (`/msg`, etc.).
 *
 * Protocol: `server/platform/services/remotecluster/service.go`, `server/channels/api4/remote_cluster.go`.
 */

import http from 'node:http';
import type {AddressInfo} from 'node:net';

import {v4 as uuidv4} from 'uuid';

/** Topics from `server/platform/services/sharedchannel/service.go` */
export const SHARED_CHANNEL_MSG_TOPICS = {
    sync: 'sharedchannel_sync',
    channelInvite: 'sharedchannel_invite',
    uploadCreate: 'sharedchannel_upload',
    channelMembership: 'sharedchannel_membership',
    globalUserSync: 'sharedchannel_global_user_sync',
} as const;

/** `model.HeaderRemoteclusterId` / `HeaderRemoteclusterToken` (`server/public/model/client4.go`). */
export const REMOTE_CLUSTER_HEADERS = {
    id: 'X-RemoteCluster-Id',
    token: 'X-RemoteCluster-Token',
} as const;

/** `remotecluster.Response` + `model.Status*` (`server/platform/services/remotecluster/response.go`). */
export const REMOTE_CLUSTER_RESPONSE_STATUS = {
    ok: 'OK',
    fail: 'FAIL',
} as const;

/** Frame over the wire (`model.RemoteClusterFrame`). */
export type RemoteClusterFrameWire = {
    remote_id: string;
    msg: {
        id: string;
        topic: string;
        create_at: number;
        payload: unknown;
    };
};

export type MockRemoteClusterInboundRecord = {
    path: string;
    headers: {
        remoteId: string | undefined;
        token: string | undefined;
    };
    frame: RemoteClusterFrameWire | null;
    rawBody: string;
};

export type MockRemoteClusterServerOptions = {
    /** When set, inbound requests must include matching headers. */
    expectedAuth?: {remoteId: string; token: string};
    host?: string;
    port?: number;
};

/**
 * How to respond to the **next** inbound `POST .../remotecluster/confirm_invite`.
 * Default when the queue is empty: accept.
 */
export type NextConfirmInviteDecision =
    | {accept: true}
    | {
          accept: false;
          /** HTTP status (default 200 with FAIL JSON is enough for `AcceptInvitation` to fail). */
          httpStatus?: number;
          /** Override JSON body; default `{ status: 'FAIL', err, payload: null }`. */
          body?: Record<string, unknown>;
          /** Used when `body` omitted (maps to `remotecluster.Response.err`). */
          err?: string;
      };

/**
 * How to respond to the **next** inbound `POST .../remotecluster/msg`.
 * Default when the queue is empty: accept with an empty sync payload.
 */
export type NextRemoteClusterMsgDecision =
    | {accept: true; syncPayload?: Record<string, unknown>}
    | {
          accept: false;
          httpStatus?: number;
          body?: Record<string, unknown>;
          err?: string;
      };

export type RemoteClusterMsgResponseWire = {
    status: string;
    err: string;
    payload?: unknown;
};

/** Credentials the **real** Mattermost server expects on inbound `/remotecluster/*` from this peer. */
export type MockOutboundPeer = {
    mattermostBaseUrl: string;
    remoteId: string;
    token: string;
};

function headerValue(req: http.IncomingMessage, canonicalName: string): string | undefined {
    const v = req.headers[canonicalName.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
}

function endsWithPath(urlPath: string, suffix: string): boolean {
    return urlPath === suffix || urlPath.endsWith(`/${suffix}`);
}

function readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (c) => chunks.push(Buffer.from(c)));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

function jsonWrite(res: http.ServerResponse, status: number, body: unknown): void {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
}

function defaultSyncPayload(): Record<string, unknown> {
    return {
        users_last_update_at: 0,
        user_errors: [],
        users_syncd: [],
        posts_last_update_at: 0,
        post_errors: [],
        reactions_last_update_at: 0,
        reaction_errors: [],
        acknowledgements_last_update_at: 0,
        acknowledgement_errors: [],
        status_errors: [],
    };
}

/**
 * Successful `/remotecluster/msg` body (`remotecluster.Response` + `model.SyncResponse` payload).
 */
export function buildRemoteClusterMsgOkResponse(syncPayload?: Record<string, unknown>): Record<string, unknown> {
    return {
        status: REMOTE_CLUSTER_RESPONSE_STATUS.ok,
        err: '',
        payload: syncPayload ?? defaultSyncPayload(),
    };
}

function buildRemoteClusterMsgFailResponse(err: string): Record<string, unknown> {
    return {
        status: REMOTE_CLUSTER_RESPONSE_STATUS.fail,
        err,
        payload: null,
    };
}

function newMsgId(): string {
    return uuidv4().replace(/-/g, '').slice(0, 26);
}

/**
 * Mock peer server + outbound client for pushing `RemoteClusterFrame`s to a real Mattermost instance.
 */
export class MockRemoteClusterServer {
    readonly options: MockRemoteClusterServerOptions;

    private server: http.Server | null = null;

    private addressInfo: AddressInfo | null = null;

    /**
     * Mutable copy of {@link MockRemoteClusterServerOptions.expectedAuth} so tests can tighten auth
     * after the Mattermost ↔ peer handshake without restarting the mock.
     */
    private inboundExpectedAuth: MockRemoteClusterServerOptions['expectedAuth'];

    /** When set, the next inbound `/msg` with topic {@link SHARED_CHANNEL_MSG_TOPICS.channelInvite} awaits {@link releaseHeldSharedChannelInvite}. */
    private sharedChannelInviteHold: Promise<void> | null = null;

    private sharedChannelInviteHoldRelease: (() => void) | null = null;

    readonly inboundLog: MockRemoteClusterInboundRecord[] = [];

    /** Pops one entry per inbound `confirm_invite` (FIFO). Empty ⇒ accept. */
    private confirmInviteQueue: NextConfirmInviteDecision[] = [];

    /** Pops one entry per inbound `/msg` whose topic is `sharedchannel_invite`. Empty ⇒ use {@link msgOtherQueue}. */
    private msgInviteTopicQueue: NextRemoteClusterMsgDecision[] = [];

    /** Pops one entry per other inbound `/msg`. Empty ⇒ accept. */
    private msgOtherQueue: NextRemoteClusterMsgDecision[] = [];

    /** Target Mattermost for {@link pushRemoteClusterMsg} / {@link pushSharedChannelInvite}. */
    private outboundPeer: MockOutboundPeer | null = null;

    constructor(options: MockRemoteClusterServerOptions = {}) {
        this.options = options;
        this.inboundExpectedAuth = options.expectedAuth;
    }

    /** Replace inbound header checks (omit or pass `undefined` to disable). */
    setInboundExpectedAuth(auth: MockRemoteClusterServerOptions['expectedAuth'] | undefined): void {
        this.inboundExpectedAuth = auth;
    }

    /**
     * Block the **next** inbound `sharedchannel_invite` `/msg` until {@link releaseHeldSharedChannelInvite}.
     * Use this so the home server keeps a **pending** invitation while the HTTP round-trip is stalled.
     */
    beginHoldNextSharedChannelInvite(): void {
        if (this.sharedChannelInviteHold) {
            throw new Error('MockRemoteClusterServer: beginHoldNextSharedChannelInvite already active');
        }
        this.sharedChannelInviteHold = new Promise<void>((resolve) => {
            this.sharedChannelInviteHoldRelease = resolve;
        });
    }

    releaseHeldSharedChannelInvite(): void {
        this.sharedChannelInviteHoldRelease?.();
        this.sharedChannelInviteHoldRelease = null;
    }

    get baseUrl(): string {
        if (!this.addressInfo) {
            throw new Error('MockRemoteClusterServer: start() before reading baseUrl');
        }
        const addr = this.addressInfo;
        const host = addr.address.includes(':') ? `[${addr.address}]` : addr.address;
        return `http://${host}:${addr.port}`;
    }

    /**
     * Where {@link pushRemoteClusterMsg} sends traffic. `token` must match `RemoteCluster.token` on the
     * receiving server for `remoteId` (what `GetRemoteClusterSession` validates).
     */
    setOutboundPeer(peer: MockOutboundPeer | null): void {
        this.outboundPeer = peer;
    }

    getOutboundPeer(): MockOutboundPeer | null {
        return this.outboundPeer;
    }

    /** Queue the response for the next inbound `POST .../remotecluster/confirm_invite`. */
    enqueueNextConfirmInvite(decision: NextConfirmInviteDecision): void {
        this.confirmInviteQueue.push(decision);
    }

    /** Queue the response for the next inbound `/msg` with topic {@link SHARED_CHANNEL_MSG_TOPICS.channelInvite}. */
    enqueueNextSharedChannelInviteMsg(decision: NextRemoteClusterMsgDecision): void {
        this.msgInviteTopicQueue.push(decision);
    }

    /** Queue the response for the next inbound `/msg` whose topic is not `sharedchannel_invite`. */
    enqueueNextRemoteClusterMsg(decision: NextRemoteClusterMsgDecision): void {
        this.msgOtherQueue.push(decision);
    }

    clearInboundDecisionQueues(): void {
        this.confirmInviteQueue = [];
        this.msgInviteTopicQueue = [];
        this.msgOtherQueue = [];
    }

    clearInboundLog(): void {
        this.inboundLog.length = 0;
    }

    /**
     * POST a `RemoteClusterFrame` to the configured Mattermost server's `/api/v4/remotecluster/msg`.
     */
    async pushRemoteClusterMsg(topic: string, payload: unknown): Promise<RemoteClusterMsgResponseWire> {
        const peer = this.requireOutboundPeer();
        const frame: RemoteClusterFrameWire = {
            remote_id: peer.remoteId,
            msg: {
                id: newMsgId(),
                topic,
                create_at: Date.now(),
                payload,
            },
        };
        return this.postToMattermost('/api/v4/remotecluster/msg', frame);
    }

    /** Convenience: topic {@link SHARED_CHANNEL_MSG_TOPICS.channelInvite}. */
    async pushSharedChannelInvite(invitePayload: unknown): Promise<RemoteClusterMsgResponseWire> {
        return this.pushRemoteClusterMsg(SHARED_CHANNEL_MSG_TOPICS.channelInvite, invitePayload);
    }

    /** Convenience: topic {@link SHARED_CHANNEL_MSG_TOPICS.sync}. */
    async pushSharedChannelSync(syncPayload: unknown): Promise<RemoteClusterMsgResponseWire> {
        return this.pushRemoteClusterMsg(SHARED_CHANNEL_MSG_TOPICS.sync, syncPayload);
    }

    private requireOutboundPeer(): MockOutboundPeer {
        if (!this.outboundPeer) {
            throw new Error('MockRemoteClusterServer: call setOutboundPeer() before pushing to Mattermost');
        }
        return this.outboundPeer;
    }

    private async postToMattermost(pathSuffix: string, body: unknown): Promise<RemoteClusterMsgResponseWire> {
        const peer = this.requireOutboundPeer();
        const base = peer.mattermostBaseUrl.replace(/\/$/, '');
        const url = `${base}${pathSuffix}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [REMOTE_CLUSTER_HEADERS.id]: peer.remoteId,
                [REMOTE_CLUSTER_HEADERS.token]: peer.token,
            },
            body: JSON.stringify(body),
        });
        const text = await res.text();
        let parsed: RemoteClusterMsgResponseWire;
        try {
            parsed = JSON.parse(text) as RemoteClusterMsgResponseWire;
        } catch {
            throw new Error(`MockRemoteClusterServer: expected JSON from Mattermost, got HTTP ${res.status}: ${text}`);
        }
        if (!res.ok) {
            throw new Error(`MockRemoteClusterServer: Mattermost returned HTTP ${res.status}: ${text}`);
        }
        return parsed;
    }

    private shiftConfirmInvite(): NextConfirmInviteDecision | undefined {
        return this.confirmInviteQueue.shift();
    }

    private shiftMsgDecision(topic: string): NextRemoteClusterMsgDecision | undefined {
        if (topic === SHARED_CHANNEL_MSG_TOPICS.channelInvite) {
            return this.msgInviteTopicQueue.shift();
        }
        return this.msgOtherQueue.shift();
    }

    private applyConfirmInviteDecision(
        res: http.ServerResponse,
        decision: NextConfirmInviteDecision | undefined,
    ): void {
        const d = decision ?? {accept: true};
        if (d.accept === true) {
            jsonWrite(res, 200, {status: REMOTE_CLUSTER_RESPONSE_STATUS.ok});
            return;
        }
        const fail = d as Extract<NextConfirmInviteDecision, {accept: false}>;
        const httpStatus = fail.httpStatus ?? 200;
        const body = fail.body ?? buildRemoteClusterMsgFailResponse(fail.err ?? 'mock: confirm_invite rejected');
        jsonWrite(res, httpStatus, body);
    }

    private applyMsgDecision(res: http.ServerResponse, decision: NextRemoteClusterMsgDecision | undefined): void {
        const d = decision ?? {accept: true};
        if (d.accept === true) {
            jsonWrite(res, 200, buildRemoteClusterMsgOkResponse(d.syncPayload ?? defaultSyncPayload()));
            return;
        }
        const fail = d as Extract<NextRemoteClusterMsgDecision, {accept: false}>;
        const httpStatus = fail.httpStatus ?? 200;
        const body = fail.body ?? buildRemoteClusterMsgFailResponse(fail.err ?? 'mock: remotecluster/msg rejected');
        jsonWrite(res, httpStatus, body);
    }

    async start(): Promise<void> {
        if (this.server) {
            return;
        }

        const host = this.options.host ?? '127.0.0.1';
        const port = this.options.port ?? 0;

        this.server = http.createServer(async (req, res) => {
            if (req.method !== 'POST') {
                res.statusCode = 405;
                res.end();
                return;
            }

            const url = new URL(req.url ?? '/', 'http://localhost');
            const pathname = url.pathname;

            const body = await readBody(req);
            const remoteId = headerValue(req, REMOTE_CLUSTER_HEADERS.id);
            const token = headerValue(req, REMOTE_CLUSTER_HEADERS.token);

            let frame: RemoteClusterFrameWire | null = null;
            if (body.length > 0) {
                try {
                    frame = JSON.parse(body) as RemoteClusterFrameWire;
                } catch {
                    frame = null;
                }
            }

            this.inboundLog.push({
                path: pathname,
                headers: {remoteId, token},
                frame,
                rawBody: body,
            });

            const auth = this.inboundExpectedAuth;
            if (auth) {
                if (remoteId !== auth.remoteId || token !== auth.token) {
                    res.statusCode = 401;
                    res.end();
                    return;
                }
            }

            if (endsWithPath(pathname, '/api/v4/remotecluster/ping')) {
                const pingPayload =
                    frame?.msg?.payload && typeof frame.msg.payload === 'object'
                        ? (frame.msg.payload as {sent_at?: number; recv_at?: number})
                        : {sent_at: Date.now()};
                const sentAt = pingPayload.sent_at ?? Date.now();
                jsonWrite(res, 200, {sent_at: sentAt, recv_at: Date.now()});
                return;
            }

            if (endsWithPath(pathname, '/api/v4/remotecluster/confirm_invite')) {
                this.applyConfirmInviteDecision(res, this.shiftConfirmInvite());
                return;
            }

            if (endsWithPath(pathname, '/api/v4/remotecluster/msg')) {
                const topic = frame?.msg?.topic ?? '';
                if (topic === SHARED_CHANNEL_MSG_TOPICS.channelInvite && this.sharedChannelInviteHold) {
                    const hold = this.sharedChannelInviteHold;
                    this.sharedChannelInviteHold = null;
                    await hold;
                }
                this.applyMsgDecision(res, this.shiftMsgDecision(topic));
                return;
            }

            if (pathname.includes('/remotecluster/upload/')) {
                res.statusCode = 204;
                res.end();
                return;
            }

            res.statusCode = 404;
            res.end();
        });

        await new Promise<void>((resolve, reject) => {
            this.server!.listen(port, host, () => resolve());
            this.server!.on('error', reject);
        });

        const addr = this.server!.address();
        if (!addr || typeof addr === 'string') {
            throw new Error('MockRemoteClusterServer: could not determine listening address');
        }
        this.addressInfo = addr;
    }

    async stop(): Promise<void> {
        this.releaseHeldSharedChannelInvite();
        if (!this.server) {
            return;
        }
        await new Promise<void>((resolve, reject) => {
            this.server!.close((err) => (err ? reject(err) : resolve()));
        });
        this.server = null;
        this.addressInfo = null;
    }
}
