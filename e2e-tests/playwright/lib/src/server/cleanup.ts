// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Runs one cleanup call and tolerates only the answer "it is already gone" (404), plus any server error ids the caller
 * names in `alsoTolerate` (each with a reason at the call site). Every other failure is rethrown, so a teardown that
 * really fails is reported instead of hidden. Use it where a test may already have removed what the cleanup removes.
 */
export async function ignoreMissing(call: () => Promise<unknown>, alsoTolerate: readonly string[] = []): Promise<void> {
    try {
        await call();
    } catch (error) {
        const {status_code: status, server_error_id: id} = error as {status_code?: number; server_error_id?: string};
        if (status === 404 || (id !== undefined && alsoTolerate.includes(id))) {
            return;
        }
        throw error;
    }
}

/**
 * Runs a test's cleanups newest first and empties the list. Every cleanup runs even when an earlier one fails, so one
 * leaked fixture does not leak the rest; the failures are then thrown together (a single one as itself).
 */
export async function runCleanups(cleanups: Array<() => Promise<unknown>>): Promise<void> {
    const pending = cleanups.splice(0).reverse();
    const failures: unknown[] = [];
    for (const cleanup of pending) {
        try {
            await cleanup();
        } catch (error) {
            failures.push(error);
        }
    }
    if (failures.length === 1) {
        throw failures[0];
    }
    if (failures.length > 1) {
        throw new AggregateError(failures, `${failures.length} cleanups failed`);
    }
}
