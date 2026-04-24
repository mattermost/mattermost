// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    disableChannelAutotranslation,
    enableChannelAutotranslation,
    setUserChannelAutotranslation,
    expect,
    test,
    setMockSourceLanguage,
} from '@mattermost/playwright-lib';

import {setupAutotranslationConfig, skipIfNoAutotranslationLicense} from './support';

test(
    'disabling at channel level stops translations',
    {
        tag: ['@autotranslation'],
    },
    async ({pw}) => {
        const {adminClient, user, userClient, team} = await pw.initSetup();

        await skipIfNoAutotranslationLicense(adminClient);
        await setupAutotranslationConfig(adminClient);

        const channelName = `autotranslation-disable-${pw.random.id()}`;
        const created = await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: 'Disable Channel Test',
            type: 'O',
        });
        await enableChannelAutotranslation(adminClient, created.id);
        await adminClient.addToChannel(user.id, created.id);
        await setUserChannelAutotranslation(userClient, created.id, true);

        const poster = await pw.random.user('poster');
        const createdPoster = await adminClient.createUser(poster, '', '');
        await adminClient.addToTeam(team.id, createdPoster.id);
        await adminClient.addToChannel(createdPoster.id, created.id);
        const {client: posterClient} = await pw.makeClient({
            username: poster.username,
            password: poster.password,
        });
        if (!posterClient) throw new Error('Failed to create poster client');

        await posterClient.createPost({
            channel_id: created.id,
            message: 'Translated before disable',
            user_id: createdPoster.id,
        });

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        // * Verify translation badge is visible (indicates translation is enabled)
        await expect(channelsPage.centerView.autotranslationBadge).toBeVisible({timeout: 15000});

        await disableChannelAutotranslation(adminClient, created.id);

        await posterClient.createPost({
            channel_id: created.id,
            message: 'After disable no translation',
            user_id: createdPoster.id,
        });

        await channelsPage.page.reload();
        await channelsPage.toBeVisible();
        await expect(channelsPage.centerView.autotranslationBadge).not.toBeVisible();
        await expect(
            channelsPage.centerView.container.getByText('After disable no translation', {exact: true}),
        ).toBeVisible();
    },
);

test(
    'opting out shows ephemeral message to user',
    {
        tag: ['@autotranslation'],
    },
    async ({pw}) => {
        const {adminClient, user, userClient, team} = await pw.initSetup();

        await skipIfNoAutotranslationLicense(adminClient);
        await setupAutotranslationConfig(adminClient);

        const channelName = `autotranslation-ephemeral-${pw.random.id()}`;
        const created = await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: 'Ephemeral Test',
            type: 'O',
        });
        await enableChannelAutotranslation(adminClient, created.id);
        await adminClient.addToChannel(user.id, created.id);
        await setUserChannelAutotranslation(userClient, created.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        await channelsPage.centerView.header.openChannelMenu();
        await page.getByRole('menuitem', {name: 'Disable autotranslation'}).click();
        await page.getByRole('button', {name: 'Turn off auto-translation'}).click();

        await expect(
            channelsPage.centerView.container.locator('p').getByText(/You disabled Auto-translation for this channel/i),
        ).toBeVisible();
    },
);

test(
    'disabling for self reverts translated messages to original',
    {
        tag: ['@autotranslation'],
    },
    async ({pw}) => {
        const {adminClient, user, userClient, team} = await pw.initSetup();

        await skipIfNoAutotranslationLicense(adminClient);
        const translationUrl = await setupAutotranslationConfig(adminClient);

        const channelName = `autotranslation-revert-${pw.random.id()}`;
        const created = await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: 'Revert Test',
            type: 'O',
        });
        await enableChannelAutotranslation(adminClient, created.id);
        await adminClient.addToChannel(user.id, created.id);
        await setUserChannelAutotranslation(userClient, created.id, true);

        const poster = await pw.random.user('poster');
        const createdPoster = await adminClient.createUser(poster, '', '');
        await adminClient.addToTeam(team.id, createdPoster.id);
        await adminClient.addToChannel(createdPoster.id, created.id);
        const {client: posterClient} = await pw.makeClient({
            username: poster.username,
            password: poster.password,
        });
        if (!posterClient) throw new Error('Failed to create poster client');

        const originalText = 'Solo texto original';
        // Set Spanish to ensure translation
        await setMockSourceLanguage(translationUrl, 'es');
        await posterClient.createPost({
            channel_id: created.id,
            message: originalText,
            user_id: createdPoster.id,
        });

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        // * Verify post with translated text appears before disabling
        // Mock server appends "[translated to en]" to the original text
        const translatedText = 'Solo texto original [translated to en]';
        const spanishPost = channelsPage.centerView.container
            .locator('[id^="post_"]')
            .filter({hasText: translatedText});
        await expect(spanishPost).toBeVisible({timeout: 15000});

        await channelsPage.centerView.header.openChannelMenu();
        await page.getByRole('menuitem', {name: 'Disable autotranslation'}).click();
        await page.getByRole('button', {name: 'Turn off auto-translation'}).click();

        // * After disabling, wait for page to update and verify original text is shown
        // Find the post containing the original text (skip system messages)
        const userPost = channelsPage.centerView.container
            .locator('[id^="post_"]')
            .filter({has: page.locator('.post__body').filter({hasText: originalText})});
        await expect(userPost).toBeVisible({timeout: 15000});
        await expect(userPost).toContainText(originalText);

        // * Verify translation indicator is no longer present
        await expect(userPost.getByRole('button', {name: 'This post has been translated'})).not.toBeVisible();
    },
);
