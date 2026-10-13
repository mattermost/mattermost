// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createHmac} from 'node:crypto';

import type {Client4} from '@mattermost/client';

function base32Decode(secret: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleaned = secret.toUpperCase().replace(/[=+\s]/g, '');
    let bits = '';
    for (const char of cleaned) {
        const value = alphabet.indexOf(char);
        if (value < 0) {
            continue;
        }
        bits += value.toString(2).padStart(5, '0');
    }

    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.slice(i, i + 8), 2));
    }
    return Buffer.from(bytes);
}

export function generateTotp(secret: string, stepSeconds = 30): string {
    const key = base32Decode(secret);
    const counter = Math.floor(Date.now() / 1000 / stepSeconds);
    const buf = Buffer.alloc(8);
    buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    buf.writeUInt32BE(counter >>> 0, 4);
    const hmac = createHmac('sha1', key).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
    return (code % 1_000_000).toString().padStart(6, '0');
}

export async function enableUserMfa(adminClient: Client4, userId: string) {
    const {secret} = await adminClient.generateMfaSecret(userId);
    await adminClient.updateUserMfa(userId, true, generateTotp(secret));
}
