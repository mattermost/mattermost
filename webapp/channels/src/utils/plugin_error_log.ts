// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Plugin-registered callbacks (matchers, placeholder transforms, …) run on the render path. A
// throwing callback is recovered from, but only the first throw per plugin is logged so a broken
// plugin is diagnosable without spamming the console on every render. `subject`/`outcome` tailor the
// message to the callback kind (default: a matcher treated as a no-match).
export function createPluginErrorLog(label: string, {subject = 'matcher', outcome = 'treating as no-match'} = {}) {
    const logged = new Set<string>();

    const logOnce = (pluginId: string, err: unknown): void => {
        if (logged.has(pluginId)) {
            return;
        }
        logged.add(pluginId);

        // eslint-disable-next-line no-console
        console.error(
            `${label}: ${subject} for plugin '${pluginId}' threw — ${outcome}.`,
            err,
        );
    };

    // Clears all entries, or just one plugin's, so its next throw logs again (e.g. on re-registration).
    const clear = (pluginId?: string): void => {
        if (pluginId === undefined) {
            logged.clear();
            return;
        }
        logged.delete(pluginId);
    };

    return {logOnce, clear};
}
