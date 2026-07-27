// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, wait} from '@/util';

const DEFAULT_ATTEMPTS = 3;

// Wraps a container's build+start so transient failures (image pull/build over a flaky network,
// occasional first-boot flakiness) get a bounded, backed-off retry instead of failing the whole
// run — and so any failure, at any attempt, is unambiguous about which container/image caused it,
// rather than surfacing as testcontainers' own generic "Failed to build image"/"Failed to start
// container" with no name attached.
export async function startWithRetry<T>(
    label: string,
    start: () => Promise<T>,
    attempts = DEFAULT_ATTEMPTS,
): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await start();
        } catch (error) {
            lastError = error;
            const message = error instanceof Error ? error.message : String(error);
            // eslint-disable-next-line no-console
            console.error(`Testcontainers: "${label}" failed on attempt ${attempt}/${attempts}: ${message}`);
            if (attempt < attempts) {
                await wait(duration.two_sec * attempt);
            }
        }
    }

    throw new Error(`Failed to start "${label}" container after ${attempts} attempts: ${String(lastError)}`, {
        cause: lastError,
    });
}
