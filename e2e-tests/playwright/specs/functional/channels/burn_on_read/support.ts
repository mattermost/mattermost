// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import type {ChannelsPage, PlaywrightExtended} from '@mattermost/playwright-lib';

export const BOR_TAG = '@burn_on_read';

export type BorSetup = {
    adminClient: Client4;
    adminUser: UserProfile;
    user: UserProfile;
    userClient: Client4;
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
    adminClient: Client4,
    team: Team,
): Promise<UserProfile & {password: string}> {
    const randomUser = await pw.random.user();
    const user = await adminClient.createUser(randomUser, '', '');
    (user as any).password = randomUser.password;
    await adminClient.addToTeam(team.id, user.id);
    return user as UserProfile & {password: string};
}

/**
 * Create multiple users and add to team
 * @param pw Playwright extended fixture
 * @param adminClient Admin client for user creation
 * @param team Team to add users to
 * @param count Number of users to create
 * @returns Array of created users with passwords
 */
export async function createMultipleUsers(
    pw: PlaywrightExtended,
    adminClient: Client4,
    team: Team,
    count: number,
): Promise<Array<UserProfile & {password: string}>> {
    const users: Array<UserProfile & {password: string}> = [];

    for (let i = 0; i < count; i++) {
        const user = await createSecondUser(pw, adminClient, team);
        users.push(user);
    }

    return users;
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

export type BorDmSetup = BorSetup & {
    sender: UserProfile;
    receiver: UserProfile & {password: string};
};

/**
 * Setup BoR + create receiver + create DM channel between the setup user (sender) and receiver
 * @param pw Playwright extended fixture
 * @param options Configuration options forwarded to setupBorTest
 * @returns Setup data plus sender/receiver users
 */
export async function setupBorDM(
    pw: PlaywrightExtended,
    options: {
        durationSeconds?: number;
        maxTTLSeconds?: number;
    } = {},
): Promise<BorDmSetup> {
    const setup = await setupBorTest(pw, options);
    const receiver = await createSecondUser(pw, setup.adminClient, setup.team);
    await setup.adminClient.createDirectChannel([setup.user.id, receiver.id]);
    return {...setup, sender: setup.user, receiver};
}

/**
 * Create a private channel and ensure the given members are the exact membership
 * (admin is removed after creation to give precise recipient counts for BoR tests).
 * @param pw Playwright extended fixture
 * @param adminClient Admin client
 * @param team Team to create the channel in
 * @param memberIds User IDs to add to the channel
 * @param prefixes Name prefix (for `name`) and display prefix (for `displayName`)
 * @returns Created channel
 */
export async function createPrivateChannelWithMembers(
    pw: PlaywrightExtended,
    adminClient: Client4,
    team: Team,
    memberIds: string[],
    prefixes: {name: string; displayName: string},
): Promise<Channel> {
    const channelSuffix = Date.now().toString(36);
    const channel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            name: `${prefixes.name}-${channelSuffix}`,
            displayName: `${prefixes.displayName} ${channelSuffix}`,
            type: 'P',
        }),
    );

    for (const memberId of memberIds) {
        await adminClient.addToChannel(memberId, channel.id);
    }

    // Remove admin from channel (auto-added as creator) so channel has exactly the requested members
    const adminUser = await adminClient.getMe();
    await adminClient.removeFromChannel(adminUser.id, channel.id);

    return channel;
}

/**
 * Login as sender, navigate to the other user's DM, enable BoR toggle, and post a message.
 * @param pw Playwright extended fixture
 * @param sender User to login as
 * @param otherUser User whose DM to open
 * @param team Team context
 * @param message Message text to send
 * @returns The logged-in sender's channels page
 */
export async function loginAndPostBorDM(
    pw: PlaywrightExtended,
    sender: UserProfile,
    otherUser: UserProfile,
    team: Team,
    message: string,
): Promise<{channelsPage: ChannelsPage}> {
    const {channelsPage} = await pw.testBrowser.login(sender);
    await channelsPage.goto(team.name, `@${otherUser.username}`);
    await channelsPage.toBeVisible();
    await channelsPage.centerView.postCreate.toggleBurnOnRead();
    await channelsPage.postMessage(message);
    return {channelsPage};
}

/**
 * Login as receiver, navigate to the other user's DM, and return the last (BoR) post.
 * Does not reveal the post.
 * @param pw Playwright extended fixture
 * @param receiver User to login as
 * @param otherUser User whose DM to open
 * @param team Team context
 * @returns The logged-in receiver's channels page and the last post
 */
export async function loginReceiverOpenDM(
    pw: PlaywrightExtended,
    receiver: UserProfile,
    otherUser: UserProfile,
    team: Team,
): Promise<{channelsPage: ChannelsPage; borPost: Awaited<ReturnType<ChannelsPage['getLastPost']>>}> {
    const {channelsPage} = await pw.testBrowser.login(receiver);
    await channelsPage.goto(team.name, `@${otherUser.username}`);
    await channelsPage.toBeVisible();
    const borPost = await channelsPage.getLastPost();
    return {channelsPage, borPost};
}

/**
 * Reveal a BoR post via the concealed placeholder (clickToReveal + waitForReveal).
 * @param borPost The post returned by getLastPost
 */
export async function revealBorPost(borPost: Awaited<ReturnType<ChannelsPage['getLastPost']>>): Promise<void> {
    await borPost.concealedPlaceholder.clickToReveal();
    await borPost.concealedPlaceholder.waitForReveal();
}

/**
 * Hover over a post and open its dot (post action) menu.
 * @param borPost The post returned by getLastPost
 */
export async function openPostDotMenu(borPost: Awaited<ReturnType<ChannelsPage['getLastPost']>>): Promise<void> {
    await borPost.hover();
    await borPost.postMenu.openDotMenu();
}
