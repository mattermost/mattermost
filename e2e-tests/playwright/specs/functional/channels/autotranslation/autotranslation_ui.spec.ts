// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    ChannelsPost,
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
test.fixme(
    'translated message has indicator; click opens Show Translation modal',
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

        const channelName = `autotranslation-modal-${pw.random.id()}`;
        const created = await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: 'Show Translation Modal Test',
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

        // Create a second poster to show translation indicator (only visible with multiple users)
        const poster2 = await pw.random.user('poster2');
        const createdPoster2 = await adminClient.createUser(poster2, '', '');
        await adminClient.addToTeam(team.id, createdPoster2.id);
        await adminClient.addToChannel(createdPoster2.id, created.id);
        const {client: posterClient2} = await pw.makeClient({
            username: poster2.username,
            password: poster2.password,
        });
        if (!posterClient2) throw new Error('Failed to create second poster client');

        // Post Spanish message that's long enough for reliable detection
        await posterClient.createPost({
            channel_id: created.id,
            message: 'Este es un texto para la modal de traducción automática que debe ser lo suficientemente largo',
            user_id: createdPoster.id,
        });
        // Second user posts a message so the first user's translation indicator appears
        await posterClient2.createPost({
            channel_id: created.id,
            message: 'Segundo usuario con mensaje más largo para mejor detección de idioma',
            user_id: createdPoster2.id,
        });

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        // * Wait for post by searching for the Spanish original (mock appends "[translated to en]", no real translation)
        const modalPost = channelsPage.centerView.container
            .locator('[id^="post_"]')
            .filter({hasText: 'Este es un texto para la modal de traducción automática'});
        await expect(modalPost).toBeVisible({timeout: 15000});

        // * Check for translation button - if it exists, click it and verify modal
        const translationButton = modalPost.getByRole('button', {name: 'This post has been translated'});
        const hasTranslationButton = (await translationButton.count()) > 0;

        // Translation button should be present - test expects translation to happen
        if (!hasTranslationButton) {
            throw new Error(
                'Translation button not found on post. Expected autotranslation to produce a translated message indicator.',
            );
        }

        // Translation happened - verify the modal opens
        await translationButton.click();
        const showTranslationDialog = page.getByRole('dialog').filter({hasText: 'Show Translation'});
        await expect(showTranslationDialog).toBeVisible();
        await expect(showTranslationDialog.getByText('ORIGINAL')).toBeVisible();
        await expect(showTranslationDialog.getByText('AUTO-TRANSLATED')).toBeVisible();
    },
);

test(
    'message actions include Show translation',
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

        const channelName = `autotranslation-dotmenu-${pw.random.id()}`;
        const created = await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: 'Dot Menu Show Translation Test',
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

        // Create a second poster to show translation indicator (only visible with multiple users)
        const poster2 = await pw.random.user('poster2');
        const createdPoster2 = await adminClient.createUser(poster2, '', '');
        await adminClient.addToTeam(team.id, createdPoster2.id);
        await adminClient.addToChannel(createdPoster2.id, created.id);
        const {client: posterClient2} = await pw.makeClient({
            username: poster2.username,
            password: poster2.password,
        });
        if (!posterClient2) throw new Error('Failed to create second poster client');

        // Re-apply config immediately before posting so the server translates this message.
        // A concurrent initSetup() can reset AutoTranslationSettings.Enable to false.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        // Set Spanish source to ensure translation happens
        await setMockSourceLanguage(translationUrl, 'es');
        // Post Spanish message that's long enough for reliable detection
        await posterClient.createPost({
            channel_id: created.id,
            message: 'Este mensaje es para probar el menú de acciones con la opción de mostrar traducción automática',
            user_id: createdPoster.id,
        });
        // Second user posts a message so the first user's translation indicator appears
        await posterClient2.createPost({
            channel_id: created.id,
            message: 'Segundo usuario con mensaje más largo para mejor detección de idioma',
            user_id: createdPoster2.id,
        });

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        // * Find the target post and wait for its translation before opening the menu
        const messagePost = channelsPage.centerView.container
            .getByTestId('postView')
            .filter({hasText: 'Este mensaje es para probar el menú de acciones'});
        await messagePost.waitFor({state: 'visible', timeout: 15000});
        await expect(messagePost.getByText(/\[translated to en\]/i)).toBeVisible({timeout: 15000});

        // * Open dot menu using the established hover → wait → click pattern
        const post = new ChannelsPost(messagePost);
        await post.hover();
        await post.postMenu.toBeVisible();
        await post.postMenu.dotMenuButton.click();

        // Move mouse away so it doesn't hover over Remind and trigger its submenu.
        // The submenu's MUI portal sets aria-hidden on the main menu, breaking getByRole.
        await page.mouse.move(0, 0);
        await channelsPage.postDotMenu.toBeVisible();

        // * Verify the "Show translation" menu item is present
        await expect(channelsPage.postDotMenu.showTranslationMenuItem).toBeVisible({timeout: 10000});
    },
);

test(
    'any user can disable and enable again autotranslation for themselves in a channel',
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

        const channelName = `autotranslation-toggle-${pw.random.id()}`;
        const created = await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: 'Autotranslation Toggle Test',
            type: 'O',
        });
        await enableChannelAutotranslation(adminClient, created.id);
        await adminClient.addToChannel(user.id, created.id);
        await setUserChannelAutotranslation(userClient, created.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        // Re-apply config + reload to counter concurrent initSetup() resets.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        await channelsPage.page.reload();
        await channelsPage.toBeVisible();

        await expect(channelsPage.centerView.autotranslationBadge).toBeVisible({timeout: 15000});

        await channelsPage.centerView.header.openChannelMenu();
        await page.getByRole('menuitem', {name: 'Disable autotranslation'}).click();
        await page.getByRole('button', {name: 'Turn off auto-translation'}).click();

        await expect(channelsPage.centerView.autotranslationBadge).not.toBeVisible();

        await channelsPage.centerView.header.openChannelMenu();
        await page.getByRole('menuitem', {name: 'Enable autotranslation'}).click();

        await expect(channelsPage.centerView.autotranslationBadge).toBeVisible({timeout: 15000});
    },
);

test(
    'autotranslation badge is only visible on translated channels',
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

        const translatedChannelName = `autotranslation-badge-${pw.random.id()}`;
        const translatedChannel = await adminClient.createChannel({
            team_id: team.id,
            name: translatedChannelName,
            display_name: 'Translated Channel',
            type: 'O',
        });
        await enableChannelAutotranslation(adminClient, translatedChannel.id);
        await adminClient.addToChannel(user.id, translatedChannel.id);
        await setUserChannelAutotranslation(userClient, translatedChannel.id, true);

        const noTranslationChannelName = `no-translation-${pw.random.id()}`;
        const noTranslationChannel = await adminClient.createChannel({
            team_id: team.id,
            name: noTranslationChannelName,
            display_name: 'No Translation Channel',
            type: 'O',
        });
        await adminClient.addToChannel(user.id, noTranslationChannel.id);

        const {channelsPage} = await pw.testBrowser.login(user);

        await channelsPage.goto(team.name, translatedChannelName);
        await channelsPage.toBeVisible();

        // Re-apply config + reload to counter concurrent initSetup() resets.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        await channelsPage.page.reload();
        await channelsPage.toBeVisible();

        await expect(channelsPage.centerView.autotranslationBadge).toBeVisible({timeout: 15000});

        await channelsPage.goto(team.name, noTranslationChannelName);
        await channelsPage.toBeVisible();
        await expect(channelsPage.centerView.autotranslationBadge).not.toBeVisible();
    },
);

test(
    'unsupported language does not show channel badge and shows message in channel header menu',
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

        const channelName = `autotranslation-unsupported-${pw.random.id()}`;
        const created = await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: 'Unsupported Language Test',
            type: 'O',
        });
        await enableChannelAutotranslation(adminClient, created.id);
        await adminClient.addToChannel(user.id, created.id);

        await userClient.patchMe({locale: 'fr'});

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        // Re-apply config + reload to ensure the browser reads the latest AutoTranslationSettings.
        // The badge should still be absent (French locale is not in targetLanguages), but the
        // server config must be active so the channel header menu shows the "unsupported" notice.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        await channelsPage.page.reload();
        await channelsPage.toBeVisible();

        await expect(channelsPage.centerView.autotranslationBadge).not.toBeVisible();

        await channelsPage.centerView.header.openChannelMenu();
        const channelMenu = page
            .getByRole('menu')
            .filter({has: page.getByRole('menuitem', {name: /Auto-translation|Channel Settings/})});
        await expect(channelMenu.getByText('Auto-translation', {exact: true})).toBeVisible();
        await expect(channelMenu.getByText('Your language is not supported')).toBeVisible();
        const autotranslationItem = page.getByRole('menuitem', {name: /Auto-translation/});
        await expect(autotranslationItem).toBeDisabled();
    },
);
