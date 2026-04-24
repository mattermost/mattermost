// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    disableAutotranslationConfig,
    enableAutotranslationConfig,
    enableChannelAutotranslation,
    getAdminClient,
    hasAutotranslationLicense,
    setUserChannelAutotranslation,
    expect,
    test,
    setMockSourceLanguage,
} from '@mattermost/playwright-lib';

// Autotranslation tests involve real UI interactions with plugin state and can run
// longer than the default 60 s in loaded CI.  Set per-test timeout to 2 minutes.
test.beforeEach(async () => {
    test.setTimeout(120000);
});

// Disable AutoTranslationSettings at end of file so leftover state cannot leak
// into other suites. Individual tests enable the feature via
// enableAutotranslationConfig() as needed.
test.afterAll(async () => {
    try {
        const {adminClient} = await getAdminClient({skipLog: true});
        await disableAutotranslationConfig(adminClient);
    } catch {
        // Best-effort cleanup.
    }
});
test(
    'auto-translation is ON by default for new channel members',
    {
        tag: ['@autotranslation'],
    },
    async ({pw}) => {
        const {adminClient, user, team} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        test.skip(
            !hasAutotranslationLicense(license.SkuShortName),
            'Skipping test - server does not have Entry or Advanced license',
        );
        const translationUrl = process.env.TRANSLATION_SERVICE_URL || 'http://localhost:3010';
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: translationUrl,
            targetLanguages: ['en', 'es'],
        });

        const channelName = `autotranslation-default-on-${pw.random.id()}`;
        const created = await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: 'Default On Test',
            type: 'O',
        });
        await enableChannelAutotranslation(adminClient, created.id);

        const poster = await pw.random.user('poster');
        const createdPoster = await adminClient.createUser(poster, '', '');
        await adminClient.addToTeam(team.id, createdPoster.id);
        await adminClient.addToChannel(createdPoster.id, created.id);
        const {client: posterClient} = await pw.makeClient({
            username: poster.username,
            password: poster.password,
        });
        if (!posterClient) throw new Error('Failed to create poster client');

        // Re-apply config immediately before the post so the server translates it.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        // Set Spanish source to ensure translation happens for new member
        await setMockSourceLanguage(translationUrl, 'es');
        await posterClient.createPost({
            channel_id: created.id,
            message: 'Hola para nuevo miembro',
            user_id: createdPoster.id,
        });

        await adminClient.addToChannel(user.id, created.id);
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        // Re-apply config + reload so the badge and translated text reflect the latest server config.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        await channelsPage.page.reload();
        await channelsPage.toBeVisible();

        // * Verify translation badge is visible (indicates autotranslation is ON by default)
        await expect(channelsPage.centerView.autotranslationBadge).toBeVisible({timeout: 15000});

        // * Verify post appeared with translation (mock server appends "[translated to en]" to original)
        await expect(
            channelsPage.centerView.container
                .locator('[id^="post_"]')
                .getByText('Hola para nuevo miembro [translated to en]', {exact: false}),
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

        const license = await adminClient.getClientLicenseOld();
        test.skip(
            !hasAutotranslationLicense(license.SkuShortName),
            'Skipping test - server does not have Entry or Advanced license',
        );
        const translationUrl = process.env.TRANSLATION_SERVICE_URL || 'http://localhost:3010';
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: translationUrl,
            targetLanguages: ['en', 'es'],
        });

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

        // Re-apply config + reload so the badge reflects the latest AutoTranslationSettings.
        // A concurrent initSetup() → updateConfig(defaultConfig) resets Enable to false,
        // preventing the badge from appearing and the "Disable autotranslation" menu item
        // from being shown.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        await channelsPage.page.reload();
        await channelsPage.toBeVisible();

        // Wait for autotranslation state to be reflected in the header before opening the menu,
        // so that the "Disable autotranslation" menu item is present when the menu opens.
        await expect(channelsPage.centerView.autotranslationBadge).toBeVisible({timeout: 15000});

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

        const license = await adminClient.getClientLicenseOld();
        test.skip(
            !hasAutotranslationLicense(license.SkuShortName),
            'Skipping test - server does not have Entry or Advanced license',
        );
        const translationUrl = process.env.TRANSLATION_SERVICE_URL || 'http://localhost:3010';
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: translationUrl,
            targetLanguages: ['en', 'es'],
        });

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
        // Re-apply config immediately before posting so the server translates this message.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
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

test(
    'messages only translate when source differs from user language',
    {
        tag: ['@autotranslation'],
    },
    async ({pw}) => {
        const {adminClient, user, userClient, team} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        test.skip(
            !hasAutotranslationLicense(license.SkuShortName),
            'Skipping test - server does not have Entry or Advanced license',
        );
        const translationUrl = process.env.TRANSLATION_SERVICE_URL || 'http://localhost:3010';
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: translationUrl,
            targetLanguages: ['en', 'es'],
        });

        const channelName = `autotranslation-lang-${pw.random.id()}`;
        const created = await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: 'Language Rules Test',
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

        // Create a second poster to test translation indicators (only show with multiple users)
        const poster2 = await pw.random.user('poster2');
        const createdPoster2 = await adminClient.createUser(poster2, '', '');
        await adminClient.addToTeam(team.id, createdPoster2.id);
        await adminClient.addToChannel(createdPoster2.id, created.id);
        const {client: posterClient2} = await pw.makeClient({
            username: poster2.username,
            password: poster2.password,
        });
        if (!posterClient2) throw new Error('Failed to create second poster client');

        // Re-apply config immediately before posting so the server translates these messages.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        // Set source language for mock/real server before creating posts
        // For mock: controls which language is detected; for real: auto-detection is used
        // Post Spanish first so it gets the translation indicator (first message from posterClient)
        await setMockSourceLanguage(translationUrl, 'es');
        await posterClient.createPost({
            channel_id: created.id,
            message: 'Solo español',
            user_id: createdPoster.id,
        });
        // English message won't be translated
        await setMockSourceLanguage(translationUrl, 'en');
        await posterClient.createPost({
            channel_id: created.id,
            message: 'English only',
            user_id: createdPoster.id,
        });
        // Second user posts translated message (translation indicators only show with multiple users)
        await posterClient2.createPost({
            channel_id: created.id,
            message: 'Hola desde segundo usuario',
            user_id: createdPoster2.id,
        });

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        // * Verify both posts appear
        // Mock server produces "<original> [translated to en]", not real translations
        await expect(channelsPage.centerView.container.locator('[id^="post_"]').getByText('English only')).toBeVisible({
            timeout: 15000,
        });
        await expect(
            channelsPage.centerView.container
                .locator('[id^="post_"]')
                .getByText('Solo español [translated to en]', {exact: false}),
        ).toBeVisible({timeout: 15000});

        // * Verify both messages are present
        const spanishPost = channelsPage.centerView.container
            .locator('[id^="post_"]')
            .filter({hasText: 'Solo español [translated to en]'});
        await expect(spanishPost).toBeVisible({timeout: 15000});

        // * Verify English message is present and unchanged
        const englishPost = channelsPage.centerView.container
            .locator('[id^="post_"]')
            .filter({hasText: 'English only'});
        await expect(englishPost).toBeVisible();
    },
);

test(
    'message indicator only on actually translated message',
    {
        tag: ['@autotranslation'],
    },
    async ({pw}) => {
        const {adminClient, user, userClient, team} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        test.skip(
            !hasAutotranslationLicense(license.SkuShortName),
            'Skipping test - server does not have Entry or Advanced license',
        );
        const translationUrl = process.env.TRANSLATION_SERVICE_URL || 'http://localhost:3010';
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: translationUrl,
            targetLanguages: ['en', 'es'],
        });

        const channelName = `autotranslation-indicator-${pw.random.id()}`;
        const created = await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: 'Indicator Test',
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

        // Create a second poster to test translation indicators (only show with multiple users)
        const poster2 = await pw.random.user('poster2');
        const createdPoster2 = await adminClient.createUser(poster2, '', '');
        await adminClient.addToTeam(team.id, createdPoster2.id);
        await adminClient.addToChannel(createdPoster2.id, created.id);
        const {client: posterClient2} = await pw.makeClient({
            username: poster2.username,
            password: poster2.password,
        });
        if (!posterClient2) throw new Error('Failed to create second poster client');

        // Re-apply config immediately before posting so the server translates these messages.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        // Set source language before creating posts
        // Post Spanish first so it gets the translation indicator (first message from posterClient)
        await setMockSourceLanguage(translationUrl, 'es');
        await posterClient.createPost({
            channel_id: created.id,
            message: 'Solo español',
            user_id: createdPoster.id,
        });
        // English message won't be translated
        await setMockSourceLanguage(translationUrl, 'en');
        await posterClient.createPost({
            channel_id: created.id,
            message: 'English only',
            user_id: createdPoster.id,
        });
        // Second user posts translated message (translation indicators only show with multiple users)
        await posterClient2.createPost({
            channel_id: created.id,
            message: 'Otro mensaje en español',
            user_id: createdPoster2.id,
        });

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        // * Verify posts appeared
        // Mock server produces "<original> [translated to en]", not real translations
        await expect(channelsPage.centerView.container.locator('[id^="post_"]').getByText('English only')).toBeVisible({
            timeout: 15000,
        });
        await expect(
            channelsPage.centerView.container
                .locator('[id^="post_"]')
                .getByText('Solo español [translated to en]', {exact: false}),
        ).toBeVisible();

        // * Verify both messages are present
        const translatedPost = channelsPage.centerView.container
            .locator('[id^="post_"]')
            .filter({hasText: 'Solo español [translated to en]'});
        await expect(translatedPost).toBeVisible({timeout: 15000});

        const notTranslatedPost = channelsPage.centerView.container
            .locator('[id^="post_"]')
            .filter({hasText: 'English only', exact: true});
        await expect(notTranslatedPost).toBeVisible();
    },
);
