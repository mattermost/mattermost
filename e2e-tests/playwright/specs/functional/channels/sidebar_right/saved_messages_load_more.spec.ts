// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import type {Client4} from '@mattermost/client';
import type {UserProfile} from '@mattermost/types/users';

import {expect, test} from '@mattermost/playwright-lib';
import type {ChannelsPage} from '@mattermost/playwright-lib';

// More saved posts than the webapp's page size of 60, so the list spans two pages.
const TOTAL = 65;
const PAGE_SIZE = 60;

const FLAGGED_POSTS = /\/posts\/flagged\?/;

async function savePosts(userClient: Client4, user: UserProfile, postIds: string[]) {
    await userClient.savePreferences(
        user.id,
        postIds.map((id) => ({user_id: user.id, category: 'flagged_post', name: id, value: 'true'})),
    );
}

async function unsavePosts(userClient: Client4, user: UserProfile, postIds: string[]) {
    await userClient.deletePreferences(
        user.id,
        postIds.map((id) => ({user_id: user.id, category: 'flagged_post', name: id, value: 'true'})),
    );
}

/**
 * Creates and saves `total` posts labelled `<prefix> 0` (oldest) to `<prefix> <total-1>` (newest),
 * returning their ids oldest first.
 */
async function createSavedPosts(userClient: Client4, user: UserProfile, channelId: string, prefix: string) {
    const postIds: string[] = [];
    for (let i = 0; i < TOTAL; i++) {
        const post = await userClient.createPost({channel_id: channelId, message: `${prefix} ${i}`});
        postIds.push(post.id);
    }
    await savePosts(userClient, user, postIds);
    return postIds;
}

function trackFlaggedPostsRequests(page: Page) {
    const requests: URL[] = [];
    page.on('request', (request) => {
        if (FLAGGED_POSTS.test(request.url())) {
            requests.push(new URL(request.url()));
        }
    });
    return requests;
}

/**
 * The label numbers of the saved messages in the panel, in display order.
 */
async function savedLabels(channelsPage: ChannelsPage, prefix: string) {
    const texts = await channelsPage.searchResultsPanel.getResultItems().allInnerTexts();
    const label = new RegExp(`${prefix} (\\d+)`);
    return texts.map((text: string) => Number(text.match(label)?.[1] ?? NaN));
}

function newestFirst(labels: number[]) {
    return [...labels].sort((a, b) => b - a);
}

function range(count: number) {
    return Array.from({length: count}, (_, i) => i);
}

async function scrollUntilVisible(channelsPage: ChannelsPage, text: string) {
    const items = channelsPage.searchResultsPanel.getResultItems();
    const target = channelsPage.searchResultsPanel.getResultByText(text);
    await expect(async () => {
        await items.last().scrollIntoViewIfNeeded();
        await expect(target).toBeVisible({timeout: 1000});
    }).toPass();
}

function getSpinner(channelsPage: ChannelsPage) {
    return channelsPage.searchResultsPanel.container.locator('.loading-screen');
}

/**
 * @objective Verify Saved messages loads older saved messages as the user scrolls past the first page,
 * requesting each page once by cursor and stopping at the end.
 *
 * @precondition
 * A user has saved more messages than fit on one page.
 */
test('MM-49216 loads more saved messages on scroll', async ({pw}) => {
    // # Create a user with more saved messages than fit on one page
    const {user, team, userClient} = await pw.initSetup();
    const townSquare = await userClient.getChannelByName(team.id, 'town-square');
    const prefix = `saved-${pw.random.id()}`;
    const postIds = await createSavedPosts(userClient, user, townSquare.id, prefix);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    const requests = trackFlaggedPostsRequests(page);

    // # Open Saved messages
    await channelsPage.globalHeader.openSavedMessages();
    await channelsPage.searchResultsPanel.toHaveHeading('Saved messages');

    // * Verify the first page loads without a cursor and ends with a spinner
    const items = channelsPage.searchResultsPanel.getResultItems();
    await expect(items).toHaveCount(PAGE_SIZE);
    await expect(getSpinner(channelsPage)).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0].searchParams.get('before')).toBeNull();

    // # Scroll to the bottom of the list until the oldest saved message loads
    await scrollUntilVisible(channelsPage, `${prefix} 0`);

    // * Verify the second page was requested from the last post of the first page
    expect(requests).toHaveLength(2);
    expect(requests[1].searchParams.get('before')).toBe(postIds[TOTAL - PAGE_SIZE]);

    // * Verify every saved message is listed exactly once, newest first, with no spinner at the end
    await expect(items).toHaveCount(TOTAL);
    expect(await savedLabels(channelsPage, prefix)).toEqual(newestFirst(range(TOTAL)));
    await expect(getSpinner(channelsPage)).not.toBeVisible();

    // # Scroll to the end again
    await items.last().scrollIntoViewIfNeeded();
    await items.first().scrollIntoViewIfNeeded();
    await items.last().scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // * Verify no further page is requested once the list has ended
    expect(requests).toHaveLength(2);
});

/**
 * @objective Verify Saved messages shows the empty state, with no spinner, for a user with no saved messages.
 *
 * @precondition
 * A user has never saved a message.
 */
test('MM-49216 shows the empty state when nothing is saved', async ({pw}) => {
    // # Log in as a user with no saved messages
    const {user, team} = await pw.initSetup();
    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    const requests = trackFlaggedPostsRequests(page);

    // # Open Saved messages
    await channelsPage.globalHeader.openSavedMessages();
    const panel = channelsPage.searchResultsPanel.container;
    await expect(panel.getByRole('heading', {name: 'Saved messages', exact: true})).toBeVisible();

    // * Verify the empty state is shown without a spinner
    await expect(panel.getByRole('heading', {name: 'No saved messages yet'})).toBeVisible();
    await expect(getSpinner(channelsPage)).not.toBeVisible();
    await expect(channelsPage.searchResultsPanel.getResultItems()).toHaveCount(0);

    // * Verify only the first page was requested
    await page.waitForTimeout(1000);
    expect(requests).toHaveLength(1);
});

/**
 * @objective Verify unsaving loaded messages, here and from another device, does not skip messages on the next page.
 *
 * @precondition
 * A user has saved more messages than fit on one page.
 */
test('MM-49216 keeps paging after loaded saved messages are removed', async ({pw}) => {
    // # Create a user with more saved messages than fit on one page
    const {user, team, userClient} = await pw.initSetup();
    const townSquare = await userClient.getChannelByName(team.id, 'town-square');
    const prefix = `saved-${pw.random.id()}`;
    const postIds = await createSavedPosts(userClient, user, townSquare.id, prefix);

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Open Saved messages
    await channelsPage.globalHeader.openSavedMessages();
    await channelsPage.searchResultsPanel.toHaveHeading('Saved messages');
    const items = channelsPage.searchResultsPanel.getResultItems();
    await expect(items).toHaveCount(PAGE_SIZE);

    // # Remove the two newest messages from Saved in the panel
    for (const index of [TOTAL - 1, TOTAL - 2]) {
        const item = channelsPage.searchResultsPanel.getResultByText(`${prefix} ${index}`);
        await item.hover();
        await item.getByRole('button', {name: 'remove from saved'}).click();
        await expect(item).toHaveCount(0);
    }

    // # Unsave the next two from another device
    await unsavePosts(userClient, user, [postIds[TOTAL - 3], postIds[TOTAL - 4]]);

    // * Verify they leave the open panel
    await expect(channelsPage.searchResultsPanel.getResultByText(`${prefix} ${TOTAL - 3}`)).toHaveCount(0);
    await expect(channelsPage.searchResultsPanel.getResultByText(`${prefix} ${TOTAL - 4}`)).toHaveCount(0);
    await expect(items).toHaveCount(PAGE_SIZE - 4);

    // # Scroll to the bottom of the list until the oldest saved message loads
    await scrollUntilVisible(channelsPage, `${prefix} 0`);

    // * Verify every remaining saved message is listed exactly once, newest first
    await expect(items).toHaveCount(TOTAL - 4);
    expect(await savedLabels(channelsPage, prefix)).toEqual(newestFirst(range(TOTAL - 4)));
    await expect(getSpinner(channelsPage)).not.toBeVisible();
});

/**
 * @objective Verify a message saved from another device appears in the open Saved messages panel,
 * and is not repeated when older pages load.
 *
 * @precondition
 * A user has saved more messages than fit on one page, and has an unsaved message in a channel they haven't opened.
 */
test('MM-49216 shows messages saved elsewhere while the panel is open', async ({pw}) => {
    // # Create a user with more saved messages than fit on one page
    const {user, team, userClient, adminClient} = await pw.initSetup();
    const townSquare = await userClient.getChannelByName(team.id, 'town-square');
    const prefix = `saved-${pw.random.id()}`;
    await createSavedPosts(userClient, user, townSquare.id, prefix);

    // # Post a newer, unsaved message in a channel the browser won't open
    const otherChannel = await adminClient.createChannel(
        pw.random.channel({teamId: team.id, name: 'saved-elsewhere', displayName: 'Saved Elsewhere'}),
    );
    await adminClient.addToChannel(user.id, otherChannel.id);
    const fresh = await userClient.createPost({channel_id: otherChannel.id, message: `${prefix} ${TOTAL}`});

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Open Saved messages
    await channelsPage.globalHeader.openSavedMessages();
    await channelsPage.searchResultsPanel.toHaveHeading('Saved messages');
    const items = channelsPage.searchResultsPanel.getResultItems();
    await expect(items).toHaveCount(PAGE_SIZE);

    // # Save the new message from another device
    await savePosts(userClient, user, [fresh.id]);

    // * Verify it appears at the top of the open panel
    await expect(items.first()).toContainText(`${prefix} ${TOTAL}`);
    await expect(items.first()).toContainText(otherChannel.display_name);

    // # Scroll to the bottom of the list until the oldest saved message loads
    await scrollUntilVisible(channelsPage, `${prefix} 0`);

    // * Verify every saved message is listed exactly once, newest first
    await expect(items).toHaveCount(TOTAL + 1);
    expect(await savedLabels(channelsPage, prefix)).toEqual(newestFirst(range(TOTAL + 1)));
    await expect(getSpinner(channelsPage)).not.toBeVisible();
});

/**
 * @objective Verify a failed page of Saved messages offers Try again, doesn't retry on its own, and recovers without gaps.
 *
 * @precondition
 * A user has saved more messages than fit on one page.
 */
test('MM-49216 retries a saved messages page that failed to load', async ({pw}) => {
    // # Create a user with more saved messages than fit on one page
    const {user, team, userClient} = await pw.initSetup();
    const townSquare = await userClient.getChannelByName(team.id, 'town-square');
    const prefix = `saved-${pw.random.id()}`;
    await createSavedPosts(userClient, user, townSquare.id, prefix);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Fail every request for a page after the first
    let failing = true;
    let failed = 0;
    await page.route(FLAGGED_POSTS, async (route) => {
        if (failing && new URL(route.request().url()).searchParams.has('before')) {
            failed++;
            await route.abort('failed');
            return;
        }
        await route.continue();
    });

    // # Open Saved messages and scroll to the end of the first page
    await channelsPage.globalHeader.openSavedMessages();
    await channelsPage.searchResultsPanel.toHaveHeading('Saved messages');
    const items = channelsPage.searchResultsPanel.getResultItems();
    await expect(items).toHaveCount(PAGE_SIZE);
    await items.last().scrollIntoViewIfNeeded();

    // * Verify the spinner is replaced by an error with a Try again button, keeping the loaded messages
    const error = channelsPage.searchResultsPanel.container.getByRole('alert');
    await expect(error).toContainText("Couldn't load more messages.");
    const tryAgain = error.getByRole('button', {name: 'Try again'});
    await expect(tryAgain).toBeVisible();
    await expect(getSpinner(channelsPage)).not.toBeVisible();
    await expect(items).toHaveCount(PAGE_SIZE);
    expect(failed).toBe(1);

    // # Scroll up and back down
    await items.first().scrollIntoViewIfNeeded();
    await items.last().scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // * Verify the page isn't retried automatically
    expect(failed).toBe(1);

    // # Click Try again while requests still fail
    await tryAgain.click();

    // * Verify exactly one more attempt is made and the error is shown again
    await expect.poll(() => failed).toBe(2);
    await expect(tryAgain).toBeVisible();

    // # Let requests succeed and click Try again
    failing = false;
    await tryAgain.click();

    // * Verify the error is gone and the next page follows the first without a gap
    await expect(error).not.toBeVisible();
    await scrollUntilVisible(channelsPage, `${prefix} 0`);
    await expect(items).toHaveCount(TOTAL);
    expect(await savedLabels(channelsPage, prefix)).toEqual(newestFirst(range(TOTAL)));
    await expect(getSpinner(channelsPage)).not.toBeVisible();
});
