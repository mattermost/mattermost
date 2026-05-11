// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Test-side simulation of a peer Mattermost accepting a secure-connection invite by POSTing
 * `RemoteClusterFrame` topic `invitation` to the originating server's `/api/v4/remotecluster/confirm_invite`
 * (same contract as `server/platform/services/remotecluster/invitation.go` `makeConfirmFrame`).
 */

import {createDecipheriv, pbkdf2Sync, randomBytes} from 'node:crypto';

import {REMOTE_CLUSTER_HEADERS} from './mock_remote_cluster_server';

const MM_BASE32 = 'ybndrfg8ejkmcpqxot1uwisza345h769';

/** Same alphabet/length as `model.NewId` (`server/public/model/utils.go`). */
export function mattermostNewId(): string {
    const buf = randomBytes(16);
    let bits = 0;
    let value = 0;
    let out = '';
    for (let i = 0; i < buf.length; i++) {
        value = (value << 8) | buf[i]!;
        bits += 8;
        while (bits >= 5) {
            out += MM_BASE32[(value >>> (bits - 5)) & 31]!;
            bits -= 5;
        }
    }
    if (bits > 0) {
        out += MM_BASE32[(value << (5 - bits)) & 31]!;
    }
    return out;
}

function decodeBase64UrlInvite(code: string): Buffer {
    let s = code.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) {
        s += '=';
    }
    return Buffer.from(s, 'base64');
}

export type DecryptedRemoteClusterInvite = {
    remote_id: string;
    site_url: string;
    token: string;
    version?: number;
};

/**
 * Decrypts a v3+ `RemoteClusterInvite` blob (`model.RemoteClusterInvite.Decrypt` / PBKDF2 + AES-GCM).
 */
export function decryptRemoteClusterInviteFromBase64(inviteBase64: string, password: string): DecryptedRemoteClusterInvite {
    const encrypted = decodeBase64UrlInvite(inviteBase64);
    if (encrypted.length <= 16) {
        throw new Error('remote_cluster_peer_confirm: invite blob too short');
    }
    const salt = encrypted.subarray(0, 16);
    const rest = encrypted.subarray(16);
    const key = pbkdf2Sync(password, salt, 600_000, 32, 'sha256');
    const decipher = createDecipheriv('aes-256-gcm', key, rest.subarray(0, 12));
    decipher.setAuthTag(rest.subarray(rest.length - 16));
    const plain = Buffer.concat([decipher.update(rest.subarray(12, rest.length - 16)), decipher.final()]);
    const parsed = JSON.parse(plain.toString('utf8')) as DecryptedRemoteClusterInvite;
    if (!parsed.remote_id || !parsed.site_url || !parsed.token) {
        throw new Error('remote_cluster_peer_confirm: decrypted invite missing required fields');
    }
    return parsed;
}

function joinApiPath(siteUrl: string, suffix: string): string {
    const base = siteUrl.replace(/\/$/, '');
    const path = suffix.startsWith('/') ? suffix : `/${suffix}`;
    return `${base}${path}`;
}

export type PostRemoteClusterConfirmInviteFromPeerParams = {
    /** Encrypted invite string from the Admin Console (same encoding as Mattermost `CreateRemoteClusterInvite`). */
    inviteBase64: string;
    password: string;
    /** Public URL of the mock peer; becomes `RemoteClusterInvite.site_url` on the home server after confirm. */
    peerSiteUrl: string;
};

export type PostRemoteClusterConfirmInviteFromPeerResult = {
    /** Home server's `RemoteCluster.remote_id` (header + frame `remote_id`). */
    originRemoteId: string;
    /**
     * `confirm.Token` in the invitation frame — after confirm, the home server stores this as `RemoteCluster.remote_token`
     * for outbound calls to the peer (mock must accept these headers when set).
     */
    peerOutboundToken: string;
    /**
     * `confirm.refreshed_token` — home server stores this as `RemoteCluster.token` for inbound peer calls.
     */
    peerInboundToken: string;
};

/**
 * POST `confirm_invite` to the **originating** Mattermost using the invite password, simulating a peer that
 * accepted the invitation (`AcceptInvitation` → `sendFrameToRemote` … `confirm_invite`).
 */
export async function postRemoteClusterConfirmInviteFromPeer(
    params: PostRemoteClusterConfirmInviteFromPeerParams,
): Promise<PostRemoteClusterConfirmInviteFromPeerResult> {
    const invite = decryptRemoteClusterInviteFromBase64(params.inviteBase64, params.password);
    const peerOutboundToken = mattermostNewId();
    const peerInboundToken = mattermostNewId();
    if (peerInboundToken === invite.token) {
        throw new Error('remote_cluster_peer_confirm: unexpected token collision');
    }

    const confirmPayload = {
        remote_id: invite.remote_id,
        site_url: params.peerSiteUrl,
        token: peerOutboundToken,
        refreshed_token: peerInboundToken,
        version: 3,
    };

    const frame = {
        remote_id: invite.remote_id,
        msg: {
            id: mattermostNewId(),
            topic: 'invitation',
            create_at: Date.now(),
            payload: confirmPayload,
        },
    };

    const url = joinApiPath(invite.site_url, 'api/v4/remotecluster/confirm_invite');
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            [REMOTE_CLUSTER_HEADERS.id]: invite.remote_id,
            [REMOTE_CLUSTER_HEADERS.token]: invite.token,
        },
        body: JSON.stringify(frame),
    });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`remote_cluster_peer_confirm: confirm_invite failed HTTP ${res.status}: ${text}`);
    }

    return {
        originRemoteId: invite.remote_id,
        peerOutboundToken,
        peerInboundToken,
    };
}
