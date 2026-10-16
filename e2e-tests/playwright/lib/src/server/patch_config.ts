// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {describeLockoutRisk} from './lockout';
import {resetConfigWith} from './reset_config_with';

export type ConfigPatch = Parameters<Client4['patchConfig']>[0];

/** Re-applies the on-prem config overrides through the client that patched. */
export type RestoreConfig = () => Promise<void>;

type PendingPatch = {keys: string[]; restore: RestoreConfig};

// Lockout-capable patches not yet restored.
const pendingPatches = new Set<PendingPatch>();

function flatten(value: unknown, prefix = ''): Array<[string, unknown]> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.entries(value).flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key));
    }
    return [[prefix, value]];
}

/** Warns about lockout-capable settings in `patch` and returns a restore function bound to `client`. */
export function guardConfigPatch(client: Client4, patch: ConfigPatch): RestoreConfig {
    const risky = flatten(patch)
        .map(([key, value]) => ({key, reason: describeLockoutRisk(key, value)}))
        .filter((entry): entry is {key: string; reason: string} => entry.reason !== undefined);

    const pending: PendingPatch = {keys: risky.map((entry) => entry.key), restore: async () => {}};
    let restored = false;
    pending.restore = async () => {
        if (restored) {
            return;
        }
        restored = true;
        pendingPatches.delete(pending);
        await resetConfigWith(client);
    };

    if (risky.length > 0) {
        pendingPatches.add(pending);
        // eslint-disable-next-line no-console
        console.warn(
            `[patchConfig] ${risky.map((entry) => `${entry.key} (${entry.reason})`).join('; ')}. ` +
                'This can lock the admin out of the server: call restore() from the result of patchConfig() ' +
                'in a finally block.',
        );
    }

    return pending.restore;
}

/** Warns about and restores patches whose restore() was not called. */
export async function restorePendingConfigPatches(): Promise<void> {
    for (const pending of [...pendingPatches]) {
        // eslint-disable-next-line no-console
        console.warn(
            `[patchConfig] restore() was not called for ${pending.keys.join(', ')}; restoring it now. ` +
                'Call restore() in a finally block of the test that patched it.',
        );

        await pending.restore();
    }
}
