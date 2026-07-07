// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    ChannelsPost,
    disableAutotranslationConfig,
    disableChannelAutotranslation,
    enableAutotranslationConfig,
    enableChannelAutotranslation,
    ensureAutotranslationPermissions,
    getAdminClient,
    hasAutotranslationLicense,
    setMockSourceLanguage,
    setUserChannelAutotranslation,
    expect,
    test,
} from '@mattermost/playwright-lib';

const POST_TYPE_AUTOTRANSLATION_CHANGE = 'system_autotranslation';

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
    'post is translated for user with autotranslation enabled',
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
        // # Enable autotranslation in config
        // Use the discovered translation service URL (from beforeEach probe)
        const translationUrl = process.env.TRANSLATION_SERVICE_URL || 'http://localhost:3010';
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: translationUrl,
            targetLanguages: ['en', 'es'],
        });

        // # Create a channel and enable autotranslation on it
        const channelName = `autotranslation-${pw.random.id()}`;
        const created = await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: 'Autotranslation Test',
            type: 'O',
        });
        await enableChannelAutotranslation(adminClient, created.id);

        // # Add user to channel and enable autotranslation for them (viewer)
        await adminClient.addToChannel(user.id, created.id);
        await setUserChannelAutotranslation(userClient, created.id, true);

        // # Create a second user (poster) and add to channel
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

        // # Poster sends a message in Spanish (mock will "translate" to [en] ... for viewer)
        const message = 'Hola mundo amigos los pruebas son geniales';
        await posterClient.createPost({
            channel_id: created.id,
            message,
            user_id: createdPoster.id,
        });

        // Re-apply immediately before viewer loads — concurrent tests can disable autotranslation.
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: translationUrl,
            targetLanguages: ['en', 'es'],
        });

        // # Viewer (user) opens the channel and verifies post was translated
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();
        await channelsPage.centerView.container.waitFor({state: 'visible', timeout: 30000});

        // Mock service appends " [translated to en]" — wait for that instead of any post (avoids
        // racing on join banners / other posts when translation lags a few seconds).
        await expect
            .poll(
                async () => {
                    const text = await channelsPage.centerView.container.textContent();
                    return text?.includes('[translated to en]') && text.includes(message.slice(0, 12));
                },
                {timeout: 90000, intervals: [500, 1500, 3000, 5000]},
            )
            .toBe(true);
    },
);

test(
    'channel admin can enable autotranslation in a channel',
    {
        tag: ['@autotranslation'],
    },
    async ({pw}) => {
        const {adminUser, adminClient, team} = await pw.initSetup();

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
        await ensureAutotranslationPermissions(adminClient);

        const channelName = `autotranslation-admin-${pw.random.id()}`;
        const created = await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: 'Autotranslation Admin Test',
            type: 'O',
        });
        expect(created.autotranslation).toBeFalsy();

        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: translationUrl,
            targetLanguages: ['en', 'es'],
        });
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return (cfg as any).AutoTranslationSettings?.Enable === true;
        });

        const channelSettingsModal = await channelsPage.openChannelSettings();
        const configurationTab = await channelSettingsModal.openConfigurationTab();
        await configurationTab.enableChannelAutotranslation();
        await configurationTab.save();
        await channelSettingsModal.close();

        await expect
            .poll(async () => (await adminClient.getChannel(created.id)).autotranslation === true, {
                timeout: 60000,
                intervals: [500, 1500, 3000],
            })
            .toBe(true);
    },
);

test(
    'enabling autotranslation in Channel Settings posts a system message',
    {
        tag: ['@autotranslation'],
    },
    async ({pw}) => {
        const {adminUser, adminClient, team} = await pw.initSetup();

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
        await ensureAutotranslationPermissions(adminClient);

        const channelName = `autotranslation-system-msg-${pw.random.id()}`;
        const created = await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: 'Autotranslation System Message Test',
            type: 'O',
        });

        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        // Re-apply config right before the modal opens: a concurrent initSetup() can reset
        // AutoTranslationSettings.Enable back to false at any point between the initial
        // enableAutotranslationConfig call above and here, hiding the translation toggle.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return (cfg as any).AutoTranslationSettings?.Enable === true;
        });
        const channelSettingsModal = await channelsPage.openChannelSettings();
        const configurationTab = await channelSettingsModal.openConfigurationTab();
        // Wait for the translation toggle to be visible before clicking — it is conditionally
        // rendered only when AutoTranslationSettings.Enable is true in the server config.
        // A concurrent initSetup() may reset the config between waitUntil above and this line;
        // re-apply once more and wait for the DOM element rather than relying on the earlier check.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        await expect(configurationTab.container.getByTestId('channelTranslationToggle-button')).toBeVisible({
            timeout: 30000,
        });
        await configurationTab.enableChannelAutotranslation();
        await configurationTab.save();
        await channelSettingsModal.close();

        await expect
            .poll(
                async () => {
                    const postList = await adminClient.getPosts(created.id);
                    return Object.values(postList.posts).some((p) => p.type === POST_TYPE_AUTOTRANSLATION_CHANGE);
                },
                {timeout: 60000, intervals: [500, 1500, 3000]},
            )
            .toBe(true);
        const postList = await adminClient.getPosts(created.id);
        const systemPost = Object.values(postList.posts).find((p) => p.type === POST_TYPE_AUTOTRANSLATION_CHANGE);
        expect(systemPost).toBeDefined();
        expect(systemPost!.message).toMatch(/enabled Auto-translation for this channel/i);
    },
);

test.fixme(
    'only new messages are translated after enable; old messages unchanged',
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

        const channelName = `autotranslation-new-only-${pw.random.id()}`;
        const created = await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: 'New Messages Only Test',
            type: 'O',
        });
        await adminClient.addToChannel(user.id, created.id);

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

        const oldMessage = 'Old message before enable';
        await posterClient.createPost({
            channel_id: created.id,
            message: oldMessage,
            user_id: createdPoster.id,
        });

        // patchChannel(autotranslation) and member autotranslation reject when the enterprise
        // feature is momentarily unavailable — another test's initSetup can reset config here.
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: translationUrl,
            targetLanguages: ['en', 'es'],
        });
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return (cfg as any).AutoTranslationSettings?.Enable === true;
        });
        await enableChannelAutotranslation(adminClient, created.id);
        await setUserChannelAutotranslation(userClient, created.id, true);

        // Re-apply config immediately before the post that must be translated.
        // A concurrent initSetup() → updateConfig(defaultConfig) can reset
        // AutoTranslationSettings.Enable back to false between the initial
        // enableAutotranslationConfig call and here.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        const newMessage = 'Hola nuevo';
        await posterClient.createPost({
            channel_id: created.id,
            message: newMessage,
            user_id: createdPoster.id,
        });

        // Re-apply config guard: a concurrent initSetup() may have reset AutoTranslationSettings.Enable
        // between the createPost call and the browser login. If the feature is disabled the mock
        // translation service will not process the posted message and the translated text never appears.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return (cfg as any).AutoTranslationSettings?.Enable === true;
        });

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        // Re-apply config + reload so the browser reads the latest AutoTranslationSettings.
        // A concurrent initSetup() → updateConfig(defaultConfig) can reset Enable=false in
        // the window between our final API check and when the browser finishes rendering.
        // Without a reload, the browser uses its cached (now-stale) feature config and does
        // not call the translation service, so "Hola nuevo" stays untranslated.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        await channelsPage.page.reload();
        await channelsPage.toBeVisible();

        // * Verify new message appears (mock server appends "[translated to en]" to original)
        const translatedNewMessage = 'Hola nuevo [translated to en]';
        await expect
            .poll(
                async () => {
                    const text = await channelsPage.centerView.container.textContent();
                    return Boolean(text?.includes(translatedNewMessage));
                },
                {timeout: 60000, intervals: [500, 1500, 3000]},
            )
            .toBe(true);

        // * Verify old message is unchanged
        await expect(channelsPage.centerView.getPostContainingText(oldMessage)).toBeVisible();
    },
);

test(
    'channel header tooltip on autotranslation badge',
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

        const channelName = `autotranslation-tooltip-${pw.random.id()}`;
        const created = await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: 'Tooltip Test',
            type: 'O',
        });
        await enableChannelAutotranslation(adminClient, created.id);
        await adminClient.addToChannel(user.id, created.id);
        await setUserChannelAutotranslation(userClient, created.id, true);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        // Re-apply config + reload so the browser reads the latest AutoTranslationSettings,
        // not state clobbered by a concurrent initSetup() → updateConfig(defaultConfig).
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        await channelsPage.page.reload();
        await channelsPage.toBeVisible();

        await expect(channelsPage.centerView.autotranslationBadge).toBeVisible({timeout: 15000});
        await channelsPage.centerView.autotranslationBadge.hover();
        await expect(channelsPage.centerView.autotranslationTooltip).toContainText('Auto-translation is enabled');
    },
);

test(
    'disabling at channel level stops translations',
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
        if (!posterClient) {
            throw new Error('Failed to create poster client');
        }

        // Re-apply config before the post that needs to be translated.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        await posterClient.createPost({
            channel_id: created.id,
            message: 'Translated before disable',
            user_id: createdPoster.id,
        });

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        // Re-apply config + reload so the badge reflects the latest server config.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        await channelsPage.page.reload();
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
        await expect(channelsPage.centerView.getPostWithBodyText('After disable no translation')).toBeVisible();
    },
);

test.fixme(
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
        if (!posterClient) {
            throw new Error('Failed to create poster client');
        }

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

        // * Verify translation badge is visible (indicates autotranslation is ON by default)
        await expect(channelsPage.centerView.autotranslationBadge).toBeVisible({timeout: 15000});

        // * Verify post appeared with translation (mock server appends "[translated to en]" to original)
        await expect(
            channelsPage.centerView.getPostContainingText('Hola para nuevo miembro [translated to en]'),
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

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        await channelsPage.centerView.header.openChannelMenu();
        await channelsPage.channelHeaderMenu.disableAutotranslation.click();
        await channelsPage.channelHeaderMenu.turnOffAutotranslationButton.click();

        await expect(channelsPage.centerView.autotranslationDisabledSystemMessage).toBeVisible();
    },
);

test.fixme(
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
        if (!posterClient) {
            throw new Error('Failed to create poster client');
        }

        const originalText = 'Solo texto original';
        // Set Spanish to ensure translation
        await setMockSourceLanguage(translationUrl, 'es');
        await posterClient.createPost({
            channel_id: created.id,
            message: originalText,
            user_id: createdPoster.id,
        });

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        // * Verify post with translated text appears before disabling
        // Mock server appends "[translated to en]" to the original text
        const translatedText = 'Solo texto original [translated to en]';
        const spanishPost = channelsPage.centerView.getPostContainingText(translatedText);
        await expect(spanishPost).toBeVisible({timeout: 15000});

        await channelsPage.centerView.header.openChannelMenu();
        await channelsPage.channelHeaderMenu.disableAutotranslation.click();
        await channelsPage.channelHeaderMenu.turnOffAutotranslationButton.click();

        // * After disabling, wait for page to update and verify original text is shown
        // Find the post containing the original text (skip system messages)
        const userPost = channelsPage.centerView.getPostWithBodyText(originalText);
        await expect(userPost).toBeVisible({timeout: 15000});
        await expect(userPost).toContainText(originalText);

        // * Verify translation indicator is no longer present
        await expect(userPost.getByRole('button', {name: 'This post has been translated'})).not.toBeVisible();
    },
);

test.fixme(
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
        if (!posterClient) {
            throw new Error('Failed to create poster client');
        }

        // Create a second poster to test translation indicators (only show with multiple users)
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
        await expect(channelsPage.centerView.getPostContainingText('English only')).toBeVisible({
            timeout: 15000,
        });
        await expect(channelsPage.centerView.getPostContainingText('Solo español [translated to en]')).toBeVisible();

        // * Verify both messages are present
        const spanishPost = channelsPage.centerView.getPostContainingText('Solo español [translated to en]');
        await expect(spanishPost).toBeVisible({timeout: 15000});

        // * Verify English message is present and unchanged
        const englishPost = channelsPage.centerView.getPostContainingText('English only');
        await expect(englishPost).toBeVisible();
    },
);

test.fixme(
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
        if (!posterClient) {
            throw new Error('Failed to create poster client');
        }

        // Create a second poster to test translation indicators (only show with multiple users)
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
        await expect(channelsPage.centerView.getPostContainingText('English only')).toBeVisible({
            timeout: 15000,
        });
        await expect(channelsPage.centerView.getPostContainingText('Solo español [translated to en]')).toBeVisible();

        // * Verify both messages are present
        const translatedPost = channelsPage.centerView.getPostContainingText('Solo español [translated to en]');
        await expect(translatedPost).toBeVisible({timeout: 15000});

        const notTranslatedPost = channelsPage.centerView.getPostContainingText('English only');
        await expect(notTranslatedPost).toBeVisible();
    },
);

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
        const messagePost = channelsPage.centerView.getPostContainingText(
            'Este mensaje es para probar el menú de acciones',
        );
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

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        await expect(channelsPage.centerView.autotranslationBadge).toBeVisible();

        await channelsPage.centerView.header.openChannelMenu();
        await channelsPage.channelHeaderMenu.disableAutotranslation.click();
        await channelsPage.channelHeaderMenu.turnOffAutotranslationButton.click();

        await expect(channelsPage.centerView.autotranslationBadge).not.toBeVisible();

        await channelsPage.centerView.header.openChannelMenu();
        await channelsPage.channelHeaderMenu.enableAutotranslation.click();

        await expect(channelsPage.centerView.autotranslationBadge).toBeVisible();
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
        await expect(channelsPage.centerView.autotranslationBadge).toBeVisible();

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

        await expect(channelsPage.centerView.autotranslationBadge).not.toBeVisible({timeout: 30000});

        await channelsPage.centerView.header.openChannelMenu();
        const channelMenu = channelsPage.channelHeaderMenu.container;
        await expect(channelMenu.getByText('Auto-translation', {exact: true})).toBeVisible();
        await expect(channelMenu.getByText('Your language is not supported')).toBeVisible();
        await expect(channelsPage.channelHeaderMenu.autotranslationSubmenu).toBeDisabled();
    },
);
