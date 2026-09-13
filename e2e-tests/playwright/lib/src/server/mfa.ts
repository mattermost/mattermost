// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createHmac} from 'node:crypto';

import type {Client4} from '@mattermost/client';

import {runMmctlLocal} from './mmctl';

import {testConfig} from '@/test_config';

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

/**
 * Turns MFA off without depending on an admin API session. Enforcing MFA invalidates
 * password login for unenrolled admins, so patchConfig cannot restore the server.
 */
export async function disableMfa(adminClient?: Client4): Promise<void> {
    if (testConfig.mattermostContainerId) {
        const enable = await runMmctlLocal([
            'config',
            'set',
            'ServiceSettings.EnableMultifactorAuthentication',
            'false',
        ]);
        const enforce = await runMmctlLocal([
            'config',
            'set',
            'ServiceSettings.EnforceMultifactorAuthentication',
            'false',
        ]);
        if (enable.exitCode !== 0 || enforce.exitCode !== 0) {
            throw new Error(`Failed to disable MFA: ${enable.output} ${enforce.output}`);
        }
        return;
    }

    if (!adminClient) {
        throw new Error('disableMfa requires a Mattermost container or an admin client.');
    }

    try {
        await adminClient.patchConfig({
            ServiceSettings: {EnableMultifactorAuthentication: false, EnforceMultifactorAuthentication: false},
        });
    } catch (error) {
        throw new Error(
            'disableMfa could not restore MFA via the admin API. Enforcing MFA invalidates unenrolled admin sessions, so patchConfig returns 403. Run against Testcontainers Mattermost so mmctl --local can disable MFA, or enroll the admin in MFA before enforcing it. Original error: ' +
                String(error),
        );
    }
}
