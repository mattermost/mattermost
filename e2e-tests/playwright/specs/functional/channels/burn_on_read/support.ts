// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import type {PlaywrightClient4, PlaywrightExtended} from '@mattermost/playwright-lib';

export const BOR_TAG = '@burn_on_read';

export type BorSetup = {
    adminClient: PlaywrightClient4;
    adminUser: UserProfile;
    user: UserProfile;
    userClient: PlaywrightClient4;
    team: Team;
    offTopicUrl: string;
    townSquareUrl: string;
};

/**
 * Setup test environment with BoR feature enabled
 * @param pw Playwright extended fixture
 * @param options Configuration options
 * @returns Setup data including users, team, and clients
 */
export async function setupBorTest(
    pw: PlaywrightExtended,
    options: {
        durationSeconds?: number;
        maxTTLSeconds?: number;
    } = {},
): Promise<BorSetup> {
    const {durationSeconds = 60, maxTTLSeconds = 300} = options;

    // Ensure prerequisites
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    // Initialize setup
    const setup = await pw.initSetup();

    // Enable BoR via API - patch config instead of full update
    const currentConfig = await setup.adminClient.getConfig();
    await setup.adminClient.patchConfig({
        ServiceSettings: {
            ...currentConfig.ServiceSettings,
            EnableBurnOnRead: true,
            BurnOnReadDurationSeconds: durationSeconds,
            BurnOnReadMaximumTimeToLiveSeconds: maxTTLSeconds,
        },
    });

    return setup as BorSetup;
}

/**
 * Create a second user and add to team
 * @param pw Playwright extended fixture
 * @param adminClient Admin client for user creation
 * @param team Team to add user to
 * @returns Created user with password
 */
export async function createSecondUser(
    pw: PlaywrightExtended,
    adminClient: PlaywrightClient4,
    team: Team,
): Promise<UserProfile & {password: string}> {
    const [user] = await adminClient.createUsers(team.id, 1);
    return user as UserProfile & {password: string};
}

/**
 * Parse recipient count from tooltip text
 * @param tooltipText Tooltip text containing recipient info
 * @returns Object with revealed and total counts
 */
export function parseRecipientCount(tooltipText: string): {revealed: number; total: number} {
    const match = tooltipText.match(/Read by (\d+) of (\d+)/);
    if (!match) {
        throw new Error(`Could not parse recipient count from: ${tooltipText}`);
    }
    return {
        revealed: parseInt(match[1], 10),
        total: parseInt(match[2], 10),
    };
}

/**
 * Parse time remaining from timer text
 * @param timerText Timer text (e.g., "0:45", "1:30")
 * @returns Seconds remaining
 */
export function parseTimeRemaining(timerText: string): number {
    const parts = timerText.split(':');
    if (parts.length !== 2) {
        throw new Error(`Invalid timer format: ${timerText}`);
    }
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    return minutes * 60 + seconds;
}
