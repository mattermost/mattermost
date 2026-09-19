// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify channel autocomplete matches channel names and display names containing spaces.
 */
test('MM-T1662_1 matches channel autocomplete entries containing spaces', {tag: '@mentions'}, async ({pw}) => {
    // # Create a channel whose display name contains a space
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.createChannel({
        team_id: team.id,
        name: 'ask-anything',
        display_name: 'Ask Anything',
        type: 'O',
    });
    await adminClient.addToChannel(user.id, channel.id);

    // # Log in and open Town Square
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    const {input, suggestionList} = channelsPage.centerView.postCreate;
    const matchingInputs = [
        channel.name,
        channel.display_name,
        channel.display_name.toLowerCase(),
        'Ask Any',
        'Ask Anything ',
    ];

    for (const matchingInput of matchingInputs) {
        // # Enter each channel name or display-name variation in the post textbox
        await typeAutocomplete(input, `~${matchingInput}`);

        // * Verify the channel is suggested for every variation, including spaces and a trailing space
        await expect(suggestionList).toBeVisible();
        await expect(suggestionList.getByText(channel.display_name, {exact: true})).toBeVisible();
    }
});

/**
 * @objective Verify user autocomplete matches name fields containing spaces and closes after a complete name.
 */
test('MM-T1662_2 matches user autocomplete entries containing spaces', {tag: '@mentions'}, async ({pw}) => {
    // # Create a user with username, first name, last name, and nickname fields
    const {user, team} = await pw.initSetup();

    // # Log in as the user and open Town Square
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    const {input, suggestionList} = channelsPage.centerView.postCreate;
    const matchingInputs = [
        user.username,
        user.first_name.toLowerCase(),
        user.last_name.toLowerCase(),
        user.first_name,
        user.last_name,
        `${user.first_name} ${user.last_name.substring(0, user.last_name.length - 6)}`,
        `${user.first_name} ${user.last_name}`,
    ];

    for (const matchingInput of matchingInputs) {
        // # Enter each username or name-field variation in the post textbox
        await typeAutocomplete(input, `@${matchingInput}`);

        // * Verify the user is suggested for every username, name, and partial full-name variation
        await expect(suggestionList).toBeVisible();
        await expect(suggestionList.getByText(`@${user.username}`, {exact: false})).toBeVisible();
    }

    // # Enter the complete full name followed by a trailing space
    await typeAutocomplete(input, `@${user.first_name} ${user.last_name} `);

    // * Verify the trailing space completes the entry and closes the suggestion list
    await expect(suggestionList).not.toBeVisible();
});

async function typeAutocomplete(input: Locator, text: string) {
    await input.fill('');
    await input.pressSequentially(text);
}
