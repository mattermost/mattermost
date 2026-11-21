// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    disableAutotranslationConfig,
    enableAutotranslationConfig,
    enableChannelAutotranslation,
    getAdminClient,
    hasAutotranslationLicense,
    setMockSourceLanguage,
    setUserChannelAutotranslation,
    expect,
    test,
    Msg,
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
    const {adminClient} = await getAdminClient({skipLog: true});
    await disableAutotranslationConfig(adminClient);
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
        if (!posterClient) {
            throw new Error('Failed to create poster client');
        }

        // Create a second poster to show translation indicator (only visible with multiple users)
        const poster2 = await pw.random.user('poster2');
        const createdPoster2 = await adminClient.createUser(poster2, '', '');
        await adminClient.addToTeam(team.id, createdPoster2.id);
        await adminClient.addToChannel(createdPoster2.id, created.id);
        const {client: posterClient2} = await pw.makeClient({
            username: poster2.username,
            password: poster2.password,
        });
        if (!posterClient2) {
            throw new Error('Failed to create second poster client');
        }

        // Post Spanish message that's long enough for reliable detection
        const modalPostCreated = await posterClient.createPost({
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

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: channelName});
        await expect(app.center.postCreate).toBeVisible();

        // * Wait for the post (mock appends "[translated to en]", no real translation)
        const modalPost = app.center.postList.post(modalPostCreated);
        await expect(modalPost).toBeVisible({timeout: 15000});

        // * The translation indicator is present (autotranslation produced a translated message) and opens the modal
        await expect(modalPost.translationButton).toBeVisible();
        const showTranslationModal = await modalPost.translationButton.clickTo(app.showTranslationModal);
        await expect(showTranslationModal.original).toContainMessage(Msg.show_translation.original_badge);
        await expect(showTranslationModal.translated).toContainMessage(Msg.show_translation.auto_translated_badge);
    },
);

test.fixme(
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
        if (!posterClient) {
            throw new Error('Failed to create poster client');
        }

        // Create a second poster to show translation indicator (only visible with multiple users)
        const poster2 = await pw.random.user('poster2');
        const createdPoster2 = await adminClient.createUser(poster2, '', '');
        await adminClient.addToTeam(team.id, createdPoster2.id);
        await adminClient.addToChannel(createdPoster2.id, created.id);
        const {client: posterClient2} = await pw.makeClient({
            username: poster2.username,
            password: poster2.password,
        });
        if (!posterClient2) {
            throw new Error('Failed to create second poster client');
        }

        // Set Spanish source to ensure translation happens
        await setMockSourceLanguage(translationUrl, 'es');
        // Post Spanish message that's long enough for reliable detection
        const actionsPost = await posterClient.createPost({
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

        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: channelName});
        await expect(app.center.postCreate).toBeVisible();

        // * Find the target post and wait for its translation before opening the menu
        const messagePost = app.center.postList.post(actionsPost);
        await expect(messagePost).toBeVisible({timeout: 15000});
        await expect(messagePost).toContainText(/\[translated to en\]/i, {timeout: 15000});

        // * Open the dot menu from the post's hover menu
        await messagePost.container.hover();
        await messagePost.menu.dotMenuButton.clickTo(app.postDotMenu);

        // Move mouse away so it doesn't hover over Remind and trigger its submenu.
        // The submenu's MUI portal sets aria-hidden on the main menu, breaking getByRole.
        await page.mouse.move(0, 0);
        await expect(app.postDotMenu).toBeVisible();

        // * Verify the "Show translation" menu item is present
        await expect(app.postDotMenu.showTranslationMenuItem).toBeVisible({timeout: 10000});
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

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: channelName});
        await expect(app.center.postCreate).toBeVisible();

        await expect(app.channelHeader.autotranslationBadgeText).toBeVisible();

        const {autotranslationMenuItem} = app.channelHeader.menu;
        await app.channelHeader.openMenuButton.clickTo(autotranslationMenuItem);
        const disableModal = await autotranslationMenuItem.clickTo(app.disableAutotranslationModal);
        await disableModal.confirmButton.click();

        await expect(app.channelHeader.autotranslationBadgeText).not.toBeVisible();

        await app.channelHeader.openMenuButton.clickTo(autotranslationMenuItem);
        await expect(autotranslationMenuItem).toContainMessage(Msg.channel_header.autotranslation.enable);
        await autotranslationMenuItem.click();

        await expect(app.channelHeader.autotranslationBadgeText).toBeVisible();
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

        const {app} = await pw.testBrowser.login(user);

        await app.channelsPage.goto({team, channel: translatedChannelName});
        await expect(app.center.postCreate).toBeVisible();
        await expect(app.channelHeader.autotranslationBadgeText).toBeVisible();

        await app.channelsPage.goto({team, channel: noTranslationChannelName});
        await expect(app.center.postCreate).toBeVisible();
        await expect(app.channelHeader.autotranslationBadgeText).not.toBeVisible();
    },
);

test(
    'unsupported language does not show channel badge and shows message in channel header menu',
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
        // Target languages intentionally exclude 'en' so the test user's default locale is
        // unsupported. Changing the user's own locale instead (e.g. to 'fr') would also switch
        // the webapp UI language, breaking the literal English text assertions below as soon as
        // that locale gets a translation for these strings.
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: translationUrl,
            targetLanguages: ['es', 'de'],
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

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: channelName});
        await expect(app.center.postCreate).toBeVisible();

        // Re-apply config + reload to counter concurrent initSetup() resets, re-applying again
        // right as the page reloads so a CONFIG_CHANGED WebSocket event firing during load
        // carries our config rather than a stale reset from another parallel worker.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['es', 'de']});
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return (cfg as any).AutoTranslationSettings?.Enable === true;
        });
        await app.page.reload();
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['es', 'de']});
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return (cfg as any).AutoTranslationSettings?.Enable === true;
        });
        await expect(app.center.postCreate).toBeVisible();

        await expect(app.channelHeader.autotranslationBadgeText).not.toBeVisible();

        await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.autotranslationMenuItem);
        const {autotranslationMenuItem} = app.channelHeader.menu;
        await expect(autotranslationMenuItem).toContainMessage(
            Msg.channel_header.autotranslation.language_not_supported.title,
        );
        await expect(autotranslationMenuItem).toContainMessage(
            Msg.channel_header.autotranslation.language_not_supported.subtitle,
        );
        await expect(autotranslationMenuItem).toBeDisabled();
    },
);
