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
test(
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

        // Re-apply config immediately before posting so the server translates this message.
        // A concurrent initSetup() can reset AutoTranslationSettings.Enable to false.
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: translationUrl,
            targetLanguages: ['en', 'es'],
        });
        // Confirm Enable=true before posting — translation happens at creation time,
        // so the config must be confirmed before posts are submitted.
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return (cfg as any).AutoTranslationSettings?.Enable === true;
        });
        // Verify the mock translation service is reachable before attempting to use it.
        try {
            await fetch(translationUrl, {signal: AbortSignal.timeout(3000)});
        } catch {
            test.skip(
                true,
                `Mock translation service not reachable at ${translationUrl}. ` +
                    'Start the service or set TRANSLATION_SERVICE_URL to run this test.',
            );
            return;
        }
        // Set Spanish source so the mock returns source='es', triggering es→en translation.
        await setMockSourceLanguage(translationUrl, 'es');

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

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        // Re-apply config + reload to counter concurrent initSetup() resets.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return (cfg as any).AutoTranslationSettings?.Enable === true;
        });
        await channelsPage.page.reload();
        await channelsPage.toBeVisible();
        // Post-reload re-apply: a concurrent initSetup() may have reset
        // Enable during the ~500ms reload window.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return (cfg as any).AutoTranslationSettings?.Enable === true;
        });

        // * Wait for post by searching for the Spanish original (mock appends "[translated to en]", no real translation)
        const modalPost = channelsPage.centerView.getPostContainingText(
            'Este es un texto para la modal de traducción automática',
        );
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
        await expect(channelsPage.showTranslationModal.container).toBeVisible();
        await expect(channelsPage.showTranslationModal.container.getByText('ORIGINAL')).toBeVisible();
        await expect(channelsPage.showTranslationModal.container.getByText('AUTO-TRANSLATED')).toBeVisible();
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

        // Re-apply config immediately before posting so the server translates this message.
        // A concurrent initSetup() can reset AutoTranslationSettings.Enable to false.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        // Confirm Enable=true before posting — translation happens at creation time,
        // so the config must be confirmed before posts are submitted.
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return (cfg as any).AutoTranslationSettings?.Enable === true;
        });
        // Verify the mock translation service is reachable before attempting to use it.
        // setMockSourceLanguage() swallows connection errors internally, so we probe the
        // service directly. If it is not running, skip rather than fail — the service is
        // an external dependency started by CI but not typically present in local runs.
        try {
            await fetch(translationUrl, {signal: AbortSignal.timeout(3000)});
        } catch {
            test.skip(
                true,
                `Mock translation service not reachable at ${translationUrl}. ` +
                    'Start the service or set TRANSLATION_SERVICE_URL to run this test.',
            );
            return;
        }
        // Set Spanish source so the mock returns source='es', triggering es→en translation.
        await setMockSourceLanguage(translationUrl, 'es');
        // Post Spanish message that's long enough for reliable detection.
        await posterClient.createPost({
            channel_id: created.id,
            message: 'Este mensaje es para probar el menú de acciones con la opción de mostrar traducción automática',
            user_id: createdPoster.id,
        });
        // Second post ensures the first post's translation indicator is rendered
        // (the UI only renders it for posts that are not the last in the channel).
        await posterClient2.createPost({
            channel_id: created.id,
            message: 'Segundo usuario con mensaje más largo para mejor detección de idioma',
            user_id: createdPoster2.id,
        });

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        // Pre-reload re-apply: ensure Enable=true before the page loads so the client
        // fetches posts with translations active.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return (cfg as any).AutoTranslationSettings?.Enable === true;
        });
        await channelsPage.page.reload();
        await channelsPage.toBeVisible();
        // Post-reload re-apply: a concurrent initSetup() on another shard may have reset
        // Enable during the ~500ms reload window. Re-confirm before badge check.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return (cfg as any).AutoTranslationSettings?.Enable === true;
        });

        // * Wait for the channel-level autotranslation badge — confirms the feature is active.
        await expect(channelsPage.centerView.autotranslationBadge).toBeVisible({timeout: 15000});

        // * Wait for the translated target post to appear.
        // The mock appends "[translated to en]" to the original Spanish text, confirming
        // translation.state==='ready' so that "Show translation" will be in the dot menu.
        const messagePost = channelsPage.centerView.getPostContainingText(
            'Este mensaje es para probar el menú de acciones',
        );
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

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        // Defeat concurrent initSetup() config resets: re-apply on every poll iteration until badge appears.
        await expect
            .poll(
                async () => {
                    await enableAutotranslationConfig(adminClient, {
                        mockBaseUrl: translationUrl,
                        targetLanguages: ['en', 'es'],
                    });
                    return channelsPage.centerView.autotranslationBadge.isVisible();
                },
                {timeout: 45000, intervals: [2000]},
            )
            .toBeTruthy();

        await channelsPage.centerView.header.openChannelMenu();
        await channelsPage.channelHeaderMenu.disableAutotranslation.click();
        await channelsPage.channelHeaderMenu.turnOffAutotranslationButton.click();

        await expect(channelsPage.centerView.autotranslationBadge).not.toBeVisible();

        // Re-apply config before opening menu to ensure "Enable autotranslation" option is present.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        await channelsPage.centerView.header.openChannelMenu();
        await channelsPage.channelHeaderMenu.enableAutotranslation.click();

        // Poll with config re-apply until badge reappears.
        await expect
            .poll(
                async () => {
                    await enableAutotranslationConfig(adminClient, {
                        mockBaseUrl: translationUrl,
                        targetLanguages: ['en', 'es'],
                    });
                    return channelsPage.centerView.autotranslationBadge.isVisible();
                },
                {timeout: 45000, intervals: [2000]},
            )
            .toBeTruthy();
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
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return (cfg as any).AutoTranslationSettings?.Enable === true;
        });
        await channelsPage.page.reload();
        // Post-reload re-apply: firing the CONFIG_CHANGED WebSocket event during page load
        // rather than after prevents it from disrupting the badge render.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return (cfg as any).AutoTranslationSettings?.Enable === true;
        });
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

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        // Re-apply config + reload to ensure the browser reads the latest AutoTranslationSettings.
        // The badge should still be absent (French locale is not in targetLanguages), but the
        // server config must be active so the channel header menu shows the "unsupported" notice.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return (cfg as any).AutoTranslationSettings?.Enable === true;
        });
        await channelsPage.page.reload();
        await channelsPage.toBeVisible();

        await expect(channelsPage.centerView.autotranslationBadge).not.toBeVisible({timeout: 30000});

        await channelsPage.centerView.header.openChannelMenu();
        const channelMenu = channelsPage.channelHeaderMenu.container;
        await expect(channelMenu.getByText('Auto-translation', {exact: true})).toBeVisible({timeout: 30000});
        await expect(channelMenu.getByText('Your language is not supported')).toBeVisible({timeout: 30000});
        await expect(channelsPage.channelHeaderMenu.autotranslationSubmenu).toBeDisabled();
    },
);
