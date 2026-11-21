// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// What `settle`, `waitForApi`, `clickTo` and `pressTo` share: one absolute deadline for every step, and one reading
// of an app path.

import {testConfig} from '../test_config';

export const TIMED_OUT = Symbol('timed out');

/**
 * `p`, or TIMED_OUT once the deadline passes, also when `p` settled but the deadline passed before it was seen. A `p`
 * still pending then is left to settle on its own, with its rejection handled.
 */
export async function beforeDeadline<T>(p: Promise<T>, deadline: number): Promise<T | typeof TIMED_OUT> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), Math.max(0, deadline - Date.now()));
    });
    p.catch(() => undefined);
    try {
        const result = await Promise.race([p, timeout]);

        // a promise that had already settled wins the race even once the deadline has passed (the timer runs after
        // promise jobs), and synchronous work before the race isn't interrupted: past the deadline, nothing is accepted
        return Date.now() > deadline ? TIMED_OUT : result;
    } finally {
        clearTimeout(timer);
    }
}

/** A route path as the router compares it: no trailing slash, except for `/` itself. */
export function withoutTrailingSlash(path: string): string {
    return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

/** The app path of a URL's pathname: no subpath prefix and no trailing slash. */
export function appPath(pathname: string): string {
    return withoutTrailingSlash(testConfig.withoutSubpath(pathname));
}
