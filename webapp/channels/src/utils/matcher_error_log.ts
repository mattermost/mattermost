// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Plugin-registered matchers run on the render path. A throwing matcher is treated as a no-match,
// but the first occurrence per key is logged so a broken plugin is diagnosable without spamming the
// console on every render. Callers key by pluginId alone, or by pluginId+slot when one label hosts
// several matcher slots — the optional `slot` selects the keying scheme.
export function createMatcherErrorLog(label: string) {
    const logged = new Set<string>();

    const logOnce = (pluginId: string, err: unknown, slot?: string): void => {
        const key = slot === undefined ? pluginId : `${pluginId}:${slot}`;
        if (logged.has(key)) {
            return;
        }
        logged.add(key);
        const where = slot === undefined ? '' : ` at slot '${slot}'`;

        // eslint-disable-next-line no-console
        console.error(
            `${label}: matcher for plugin '${pluginId}'${where} threw — treating as no-match.`,
            err,
        );
    };

    // Clears all entries, or just those for one plugin: the exact-pluginId key plus any
    // `${pluginId}:`-prefixed (slot-keyed) entries. The colon guards against prefix collisions
    // between plugin ids (e.g. 'foo' vs 'foobar').
    const clear = (pluginId?: string): void => {
        if (pluginId === undefined) {
            logged.clear();
            return;
        }
        for (const key of logged) {
            if (key === pluginId || key.startsWith(`${pluginId}:`)) {
                logged.delete(key);
            }
        }
    };

    return {logOnce, clear};
}
