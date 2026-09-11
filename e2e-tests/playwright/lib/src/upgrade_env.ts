// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import path from 'node:path';

import chalk from 'chalk';

import {MATTERMOST_SERVER_IMAGE} from './containers/default_images';
import {logTestcontainers} from './containers/log';

const ENV_FILE_PATH = path.resolve(process.cwd(), '.env.testcontainers');
const BASELINE_PATH = path.resolve(process.cwd(), '.upgrade_baseline.json');

export const UPGRADE_FROM_SERVER_IMAGE_ENV = 'PW_UPGRADE_FROM_SERVER_IMAGE';

const UPGRADE_FROM_PROJECTS = new Set(['upgrade-from']);
const UPGRADE_TO_PHASE_PROJECTS = new Set(['upgrade-swap-to', 'upgrade-to']);

function isProjectSelected(projectNames: Set<string>, argv: string[] = process.argv): boolean {
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--project' && argv[i + 1]) {
            if (projectNames.has(argv[i + 1])) {
                return true;
            }
        } else if (arg.startsWith('--project=')) {
            const project = arg.slice('--project='.length);
            if (projectNames.has(project)) {
                return true;
            }
        }
    }
    return false;
}

/** Returns true when `--project` selects an upgrade-from project. */
export function isUpgradeFromProjectSelected(argv: string[] = process.argv): boolean {
    return isProjectSelected(UPGRADE_FROM_PROJECTS, argv);
}

/** Returns true when `--project` selects upgrade-swap-to or upgrade-to. */
export function isUpgradeToPhaseProjectSelected(argv: string[] = process.argv): boolean {
    return isProjectSelected(UPGRADE_TO_PHASE_PROJECTS, argv);
}

/** True for any upgrade-path Playwright project (from, swap-to, or to). */
export function isUpgradePathProjectSelected(argv: string[] = process.argv): boolean {
    return isUpgradeFromProjectSelected(argv) || isUpgradeToPhaseProjectSelected(argv);
}

/** Reads `PW_UPGRADE_FROM_SERVER_IMAGE`, failing fast when unset or blank. */
export function getUpgradeFromServerImage(): string {
    const fromImage = process.env[UPGRADE_FROM_SERVER_IMAGE_ENV]?.trim();
    if (!fromImage) {
        throw new Error(
            chalk.red(
                `${UPGRADE_FROM_SERVER_IMAGE_ENV} must be set to run the upgrade-from project. ` +
                    `Example: ${UPGRADE_FROM_SERVER_IMAGE_ENV}=mattermostdevelopment/mattermost-enterprise-edition:release-11.9 npm run test:upgrade:from`,
            ),
        );
    }
    return fromImage;
}

/**
 * Target image for upgrade-swap-to — the process/CI `SERVER_IMAGE`, not the currently
 * running from-image persisted in `.env.testcontainers`.
 */
export function getUpgradeToServerImage(): string {
    return process.env.SERVER_IMAGE?.trim() || MATTERMOST_SERVER_IMAGE;
}

/**
 * upgrade-from must boot a fresh stack on `PW_UPGRADE_FROM_SERVER_IMAGE`. An existing
 * `.env.testcontainers` means a prior run left containers behind — fail fast rather than adopt.
 */
export function assertUpgradeFromFreshStart(): void {
    if (fs.existsSync(ENV_FILE_PATH)) {
        throw new Error(
            chalk.red(
                '.env.testcontainers already exists from a prior testcontainers run. ' +
                    'Tear the stack down first with "npm run testcontainers:down", then run the upgrade-from command again.',
            ),
        );
    }
}

/** Logs the configured upgrade-from server image at Playwright config load time. */
export function logUpgradeFromServerImage(): void {
    logTestcontainers(`upgrade-from server image: ${getUpgradeFromServerImage()}`);
}

/** Logs the configured upgrade-to target (`SERVER_IMAGE`) at Playwright config load time. */
export function logUpgradeToServerImage(): void {
    logTestcontainers(`upgrade-to server image (SERVER_IMAGE): ${getUpgradeToServerImage()}`);
}

/**
 * upgrade-swap-to / upgrade-to must adopt the stack and baseline left by upgrade-from — not boot fresh.
 */
export function assertUpgradeToRequiresPriorFromRun(): void {
    if (!fs.existsSync(ENV_FILE_PATH)) {
        throw new Error(
            chalk.red(
                '.env.testcontainers not found — run upgrade-from first:\n' +
                    '  npm run testcontainers:down\n' +
                    '  PW_UPGRADE_FROM_SERVER_IMAGE=... npm run test:upgrade:from\n' +
                    '  npm run test:upgrade:to',
            ),
        );
    }

    if (!fs.existsSync(BASELINE_PATH)) {
        throw new Error(
            chalk.red(
                '.upgrade_baseline.json not found — run upgrade-from first (npm run test:upgrade:from with PW_UPGRADE_FROM_SERVER_IMAGE set).',
            ),
        );
    }
}

/** Called when upgrade-to phase cannot adopt a live Mattermost container (see startStack). */
export function upgradeToStackNotRunningError(): Error {
    return new Error(
        chalk.red(
            'The Mattermost container from upgrade-from is not running, so upgrade-to cannot adopt the stack.\n' +
                'Do not run "npm run testcontainers:down" between the two phases.\n' +
                'Recover with:\n' +
                '  npm run testcontainers:down\n' +
                '  PW_UPGRADE_FROM_SERVER_IMAGE=... npm run test:upgrade:from\n' +
                '  npm run test:upgrade:to',
        ),
    );
}
