// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {withStackLock} from '../containers/lock';
import {logTestcontainers} from '../containers/log';
import {resolveMattermostBootEnv} from '../containers/mattermost_container';
import {getMattermostContainerEnv, restartMattermostContainer} from '../containers/stack';

import {defaultBootEnv, reloadTestConfig, testConfig} from '@/test_config';
import {isUpgradePathProjectSelected} from '@/upgrade_env';

// MM_* vars on the running server that differ from a fresh boot: changed values to restore, extras to remove.
// Only the baseline's keys and ones the harness added are considered, so the image's own env is left alone.
async function envDrift(): Promise<{set: Record<string, string>; unset: string[]}> {
    const expected = resolveMattermostBootEnv(defaultBootEnv());
    const live = await getMattermostContainerEnv();

    const set: Record<string, string> = {};
    const unset: string[] = [];
    for (const [key, value] of Object.entries(live)) {
        if (!key.startsWith('MM_') || value === expected[key]) {
            continue;
        }
        if (key in expected) {
            set[key] = expected[key];
        } else if (key in testConfig.bootEnvOverrides) {
            unset.push(key);
        }
    }

    return {set, unset};
}

/**
 * Restarts the server with the env a fresh boot gets, so a spec doesn't inherit what an earlier one set through
 * ensureFeatureFlag(), ensureMinio(), ensureOpensearch() and the like. No-op when the server already matches.
 */
export async function ensureDefaultServerEnv(): Promise<void> {
    if (!testConfig.useTestContainers || isUpgradePathProjectSelected()) {
        return;
    }

    // Under the lock, with the current container id: another process may have replaced the server since this one started.
    await withStackLock('check server env', async () => {
        reloadTestConfig();
        if (!testConfig.mattermostContainerId) {
            return;
        }

        const {set, unset} = await envDrift();
        if (unset.length === 0 && Object.keys(set).length === 0) {
            return;
        }

        await restartMattermostContainer(set, unset);

        const remaining = await envDrift();
        const keys = [...Object.keys(remaining.set), ...remaining.unset];
        if (keys.length > 0) {
            throw new Error(`Server env still differs from the defaults after a restart: ${keys.join(', ')}.`);
        }
        logTestcontainers('server env is back to the defaults.');
    });
}
