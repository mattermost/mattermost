// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {logTestcontainers} from './containers/log';

export const UPGRADE_FROM_SERVER_IMAGE_ENV = 'PW_UPGRADE_FROM_SERVER_IMAGE';

const UPGRADE_FROM_PROJECTS = new Set(['upgrade-from', 'upgrade-swap-from']);

/** Returns true when `--project` selects an upgrade-from project. */
export function isUpgradeFromProjectSelected(argv: string[] = process.argv): boolean {
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--project' && argv[i + 1]) {
            if (UPGRADE_FROM_PROJECTS.has(argv[i + 1])) {
                return true;
            }
        } else if (arg.startsWith('--project=')) {
            const project = arg.slice('--project='.length);
            if (UPGRADE_FROM_PROJECTS.has(project)) {
                return true;
            }
        }
    }
    return false;
}

/** Reads `PW_UPGRADE_FROM_SERVER_IMAGE`, failing fast when unset or blank. */
export function getUpgradeFromServerImage(): string {
    const fromImage = process.env[UPGRADE_FROM_SERVER_IMAGE_ENV]?.trim();
    if (!fromImage) {
        throw new Error(
            `${UPGRADE_FROM_SERVER_IMAGE_ENV} must be set to run the upgrade-from project. ` +
                `Example: ${UPGRADE_FROM_SERVER_IMAGE_ENV}=mattermostdevelopment/mattermost-enterprise-edition:release-11.9 npm run test:upgrade:from`,
        );
    }
    return fromImage;
}

/** Logs the configured upgrade-from server image at Playwright config load time. */
export function logUpgradeFromServerImage(): void {
    logTestcontainers(`upgrade-from server image: ${getUpgradeFromServerImage()}`);
}
