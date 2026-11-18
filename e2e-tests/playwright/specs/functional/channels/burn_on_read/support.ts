// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {
    expect,
    type App,
    type generated,
    type PlaywrightClient4,
    type PlaywrightExtended,
} from '@mattermost/playwright-lib';

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
    const match = timerText.match(/(\d+):(\d{2})/);
    if (!match) {
        throw new Error(`Invalid timer format: ${timerText}`);
    }
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

// Helpers on the generated page objects: the composer (burn-on-read toggle, send), the posts by id with their
// burn-on-read badge (a button whose accessible name carries the read count), timer chip and reveal button.

export type CenterPost = ReturnType<App['center']['postList']['post']>;

/** Logs the user in and opens their DM with `other`. */
export async function openDm(pw: PlaywrightExtended, user: UserProfile, team: Team, other: {username: string}) {
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, path: 'messages', channel: `@${other.username}`});
    return app;
}

/** The center channel's last post id (waits for there to be one). */
export async function lastPostId(app: App): Promise<string> {
    let id = '';
    await expect
        .poll(async () => {
            id = (await app.center.postList.postList.keys()).at(-1) ?? '';
            return id;
        })
        .not.toBe('');
    return id;
}

/** The center channel's last post and its id. */
export async function lastPost(app: App): Promise<{id: string; post: CenterPost}> {
    const id = await lastPostId(app);
    return {id, post: app.center.postList.post({id})};
}

/** Sends a message from the composer and returns the new post once it shows. */
export async function sendMessage(app: App, message: string): Promise<{id: string; post: CenterPost}> {
    const before = (await app.center.postList.postList.keys()).at(-1);
    await app.center.postCreate.message.container.fill(message);
    await app.center.postCreate.sendButton.click();
    await expect.poll(async () => (await app.center.postList.postList.keys()).at(-1)).not.toBe(before);
    return lastPost(app);
}

/** Turns burn-on-read on in the composer and sends the message. */
export async function sendBorMessage(app: App, message: string) {
    await app.center.postCreate.burnOnReadButton.click();
    await expect(app.center.postCreate.burnOnReadLabel).toBeVisible();
    return sendMessage(app, message);
}

/** The most recent post that is still concealed (shows its reveal button), and its id. */
export async function concealedPost(app: App): Promise<{id: string; post: CenterPost}> {
    let id = '';
    await expect
        .poll(async () => {
            const keys = (await app.center.postList.postList.keys()).reverse();
            const revealCounts = await Promise.all(
                keys.map((key) => app.center.postList.post({id: key}).revealButton.locator.count()),
            );
            id = keys.find((_, i) => revealCounts[i] > 0) ?? '';
            return id;
        })
        .not.toBe('');
    return {id, post: app.center.postList.post({id})};
}

/** Reveals a concealed post and waits for the placeholder to go. */
export async function reveal(post: CenterPost) {
    await post.revealButton.click();
    await expect(post.revealButton).not.toBeVisible();
}

/** The sender's read count, from the burn-on-read badge's accessible name ("… Read by 1 of 2 recipients"). */
export async function recipientCount(post: CenterPost) {
    const label = (await post.burnOnReadButton.locator.getAttribute('aria-label')) ?? '';
    return parseRecipientCount(label);
}

/** The time left on a revealed post's timer chip, in seconds. */
export async function timeRemaining(post: CenterPost) {
    return parseTimeRemaining((await post.burnOnReadTimerButton.locator.textContent()) ?? '');
}

/** Opens a post's dot menu (hovering it first). */
export async function openDotMenu(
    app: App,
    post: CenterPost,
): Promise<generated.PostDotMenu<generated.PostDotMenuMount>> {
    await post.locator.hover();
    return post.menu.dotMenuButton.clickTo(app.postDotMenu);
}
