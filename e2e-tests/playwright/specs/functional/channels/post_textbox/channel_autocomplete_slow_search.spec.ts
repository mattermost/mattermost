// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page} from '@playwright/test';

import {expect, test} from '@mattermost/playwright-lib';

const AUTOCOMPLETE_ROUTE = /\/api\/v4\/teams\/[^/]+\/channels\/autocomplete/;

function searchedName(url: string) {
    return new URL(url).searchParams.get('name') ?? '';
}

async function typeMentionAndWaitForRequests(input: Locator, page: Page, message: string) {
    let name = '';

    for (const [index, character] of [...message].entries()) {
        let request: Promise<unknown> | undefined;
        if (index > 0) {
            name += character;
            request = page.waitForRequest(
                (request) => AUTOCOMPLETE_ROUTE.test(request.url()) && searchedName(request.url()) === name,
            );
        }

        await input.pressSequentially(character);
        await request;
    }
}

/**
 * Holds every channel search until the test releases it, so that the autocomplete can be observed while a
 * search is still in flight.
 */
async function holdChannelSearch(page: Page) {
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
        release = resolve;
    });

    await page.route(AUTOCOMPLETE_ROUTE, async (route) => {
        await released;
        await route.continue();
    });

    return release;
}

/**
 * @objective Verify that the ~channel autocomplete renders the channels it already knows about while a
 * search for more channels is still in flight, and preserves those results when the response adds a member.
 */
test(
    'channel mention autocomplete shows local channels while searching for more',
    {tag: ['@mentions']},
    async ({pw}) => {
        // # Initialize setup
        const {team, user, adminClient} = await pw.initSetup();

        // # Create a public channel that the user is a member of, so it comes from the local store
        const localChannel = await adminClient.createChannel({
            team_id: team.id,
            name: 'ac-local-' + Date.now(),
            display_name: 'AC Z Local',
            type: 'O',
        });
        await adminClient.addToChannel(user.id, localChannel.id);

        // # Create a private channel that the user is a member of. Private channels are not included in the
        // # initial local public-channel results, but the server response adds them to the same channel list.
        const privateChannel = await adminClient.createPrivateChannel(
            team.id,
            'AC A Private',
            'ac-private-' + Date.now(),
        );
        await adminClient.addToChannel(user.id, privateChannel.id);

        // # Create a channel that the user is not a member of, so it can only come from the search
        await adminClient.createChannel({
            team_id: team.id,
            name: 'ac-remote-' + Date.now(),
            display_name: 'AC Remote',
            type: 'O',
        });

        // # Log in as regular user
        const {channelsPage, page} = await pw.testBrowser.login(user);

        // # Hold the channel search open so the initial local results can be observed independently of the response
        const releaseSearch = await holdChannelSearch(page);

        // # Visit town-square channel
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Type a channel mention matching both channels
        const postCreate = channelsPage.centerView.postCreate;
        await postCreate.typeMessage('~ac-');

        // * Verify the channels the user is a member of are shown without waiting for the search
        const suggestionList = postCreate.suggestionList;
        const myChannels = suggestionList.getByRole('group', {name: 'My Channels'});
        await expect(myChannels.getByRole('option')).toContainText(['AC Z Local']);

        // * Verify the group of channels being searched for shows that it is still loading
        const otherChannels = suggestionList.getByRole('group', {name: 'Other Channels'});
        await expect(otherChannels.getByTestId('loadingSpinner')).toBeVisible();

        // # Release the response and wait for it to be delivered
        const searchResponse = page.waitForResponse(
            (response) => AUTOCOMPLETE_ROUTE.test(response.url()) && searchedName(response.url()) === 'ac-',
        );
        releaseSearch();
        await searchResponse;

        // * Verify the searched channel is shown once the search finishes
        await expect(otherChannels.getByRole('option')).toContainText(['AC Remote']);

        // * Verify the member channel added by the response is paired with its own term, rather than mutating the
        // * already-rendered local result. The order the two are rendered in is not part of what's under test.
        const myChannelOptions = myChannels.getByRole('option');
        await expect(myChannelOptions).toHaveCount(2);
        await expect(myChannelOptions.filter({hasText: 'AC A Private'})).toHaveCount(1);
        await expect(myChannelOptions.filter({hasText: 'AC Z Local'})).toHaveCount(1);
        await expect(otherChannels.getByTestId('loadingSpinner')).not.toBeVisible();
    },
);

/**
 * @objective Verify that the ~channel autocomplete keeps showing results for what has been typed when an
 * earlier, slower search finishes after a later one.
 */
test('channel mention autocomplete ignores a search that finishes out of order', {tag: ['@mentions']}, async ({pw}) => {
    // # Initialize setup
    const {team, user, adminClient} = await pw.initSetup();

    // # Create channels that the user is not a member of, so they can only come from the search
    await adminClient.createChannel({
        team_id: team.id,
        name: 'ac-alpha-' + Date.now(),
        display_name: 'AC Alpha',
        type: 'O',
    });
    await adminClient.createChannel({
        team_id: team.id,
        name: 'ac-beta-' + Date.now(),
        display_name: 'AC Beta',
        type: 'O',
    });

    // # Log in as regular user
    const {channelsPage, page} = await pw.testBrowser.login(user);

    // # Hold the shortest search while allowing the fully typed search to finish first
    const staleSearchName = 'ac-';
    let releaseStaleSearch!: () => void;
    const staleSearchReleased = new Promise<void>((resolve) => {
        releaseStaleSearch = resolve;
    });

    await page.route(AUTOCOMPLETE_ROUTE, async (route) => {
        if (searchedName(route.request().url()) === staleSearchName) {
            await staleSearchReleased;
        }
        await route.continue();
    });

    // # Visit town-square channel
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Note when the delayed search for the shortest mention finishes
    const staleSearch = page.waitForResponse(
        (response) => AUTOCOMPLETE_ROUTE.test(response.url()) && searchedName(response.url()) === staleSearchName,
    );
    const currentSearch = page.waitForResponse(
        (response) => AUTOCOMPLETE_ROUTE.test(response.url()) && searchedName(response.url()) === 'ac-alpha',
    );

    // # Type a channel mention, waiting for each request so the stale response can be held deterministically
    const postCreate = channelsPage.centerView.postCreate;
    await typeMentionAndWaitForRequests(postCreate.input, page, '~ac-alpha');

    // # Ensure the current search response is the one that populated the list before releasing the stale response
    await currentSearch;

    // * Verify only the channel matching what was typed is shown
    const otherChannels = postCreate.suggestionList.getByRole('group', {name: 'Other Channels'});
    await expect(otherChannels.getByRole('option')).toContainText(['AC Alpha']);
    await expect(otherChannels.getByRole('option')).toHaveCount(1);

    // # Release the stale response and wait for it to finish last
    releaseStaleSearch();
    await staleSearch;

    // * Verify its results are ignored, since they no longer match what was typed
    await expect(otherChannels.getByRole('option')).toHaveCount(1);
    await expect(otherChannels.getByRole('option')).toContainText(['AC Alpha']);

    // * Verify the mention can still be completed, so the suggestion list is still interactive
    await otherChannels.getByRole('option').first().click();
    await expect(postCreate.input).toHaveValue(/~ac-alpha/);
});
