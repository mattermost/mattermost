// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    disableAutotranslationConfig,
    disableChannelAutotranslation,
    enableAutotranslationConfig,
    enableChannelAutotranslation,
    getAdminClient,
    hasAutotranslationLicense,
    setMockSourceLanguage,
    setUserChannelAutotranslation,
    expect,
    test,
    closeChannelSettings,
    openChannelSettingsConfigurationTab,
    Api,
    settle,
    Msg,
    postWith,
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
    const {adminClient} = await getAdminClient({skipLog: true});
    await disableAutotranslationConfig(adminClient);
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
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: channelName});
        await expect(app.center.postCreate).toBeVisible();
        await app.center.postList.container.locator.waitFor({state: 'visible', timeout: 30000});

        // Mock service appends " [translated to en]" — wait for that instead of any post (avoids
        // racing on join banners / other posts when translation lags a few seconds).
        await expect
            .poll(
                async () => {
                    const text = await app.center.postList.container.locator.textContent();
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
        await pw.resetRoles();

        const channelName = `autotranslation-admin-${pw.random.id()}`;
        const created = await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: 'Autotranslation Admin Test',
            type: 'O',
        });
        expect(created.autotranslation).toBeFalsy();

        const {app} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: channelName});
        await expect(app.center.postCreate).toBeVisible();

        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: translationUrl,
            targetLanguages: ['en', 'es'],
        });
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return (cfg as any).AutoTranslationSettings?.Enable === true;
        });

        await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
        const channelSettingsModal = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(
            app.channelSettingsModal,
        );
        const configurationTab = await openChannelSettingsConfigurationTab(channelSettingsModal);
        await configurationTab.autotranslationSwitch.set(true);
        await expect(configurationTab.autotranslationSwitch).toBeOn();
        await settle(channelSettingsModal.savePanel.saveButton, {wait: Api.PatchChannel}).click();
        await closeChannelSettings(channelSettingsModal);

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
        await pw.resetRoles();

        const channelName = `autotranslation-system-msg-${pw.random.id()}`;
        const created = await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: 'Autotranslation System Message Test',
            type: 'O',
        });

        const {app} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: channelName});
        await expect(app.center.postCreate).toBeVisible();

        // Re-apply config right before the modal opens: a concurrent initSetup() can reset
        // AutoTranslationSettings.Enable back to false at any point between the initial
        // enableAutotranslationConfig call above and here, hiding the translation toggle.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return (cfg as any).AutoTranslationSettings?.Enable === true;
        });
        await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
        const channelSettingsModal = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(
            app.channelSettingsModal,
        );
        const configurationTab = await openChannelSettingsConfigurationTab(channelSettingsModal);
        // Wait for the translation toggle to be visible before clicking — it is conditionally
        // rendered only when AutoTranslationSettings.Enable is true in the server config.
        // A concurrent initSetup() may reset the config between waitUntil above and this line;
        // re-apply once more and wait for the DOM element rather than relying on the earlier check.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        await expect(configurationTab.autotranslationSwitch).toBeVisible({
            timeout: 30000,
        });
        await configurationTab.autotranslationSwitch.set(true);
        await expect(configurationTab.autotranslationSwitch).toBeOn();
        await settle(channelSettingsModal.savePanel.saveButton, {wait: Api.PatchChannel}).click();
        await closeChannelSettings(channelSettingsModal);

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
        expect(systemPost?.message).toMatch(/enabled Auto-translation for this channel/i);
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
        const oldPost = await posterClient.createPost({
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
        const newPost = await posterClient.createPost({
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

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: channelName});
        await expect(app.center.postCreate).toBeVisible();

        // Re-apply config + reload so the browser reads the latest AutoTranslationSettings.
        // A concurrent initSetup() → updateConfig(defaultConfig) can reset Enable=false in
        // the window between our final API check and when the browser finishes rendering.
        // Without a reload, the browser uses its cached (now-stale) feature config and does
        // not call the translation service, so "Hola nuevo" stays untranslated.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        await app.page.reload();
        await expect(app.center.postCreate).toBeVisible();

        // * Verify new message appears (mock server appends "[translated to en]" to original)
        const translatedNewMessage = 'Hola nuevo [translated to en]';
        await expect(app.center.postList.post(newPost).message.container).toContainText(translatedNewMessage, {
            timeout: 60000,
        });

        // * Verify old message is unchanged
        await expect(app.center.postList.post(oldPost).message.container).toHaveText(oldMessage);
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

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: channelName});
        await expect(app.center.postCreate).toBeVisible();

        // Re-apply config + reload so the browser reads the latest AutoTranslationSettings,
        // not state clobbered by a concurrent initSetup() → updateConfig(defaultConfig).
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        await app.page.reload();
        await expect(app.center.postCreate).toBeVisible();

        await expect(app.channelHeader.autotranslationBadgeText).toBeVisible({timeout: 15000});
        await app.channelHeader.autotranslationBadgeText.hover();
        // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the badge's tooltip comes from the shared WithTooltip, which takes no test id; it is read by its ARIA role
        await expect(app.page.getByRole('tooltip')).toContainText('Auto-translation is enabled');
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

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: channelName});
        await expect(app.center.postCreate).toBeVisible();

        // Re-apply config + reload so the badge reflects the latest server config.
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        await app.page.reload();
        await expect(app.center.postCreate).toBeVisible();

        // * Verify translation badge is visible (indicates translation is enabled)
        await expect(app.channelHeader.autotranslationBadgeText).toBeVisible({timeout: 15000});

        await disableChannelAutotranslation(adminClient, created.id);

        const afterDisablePost = await posterClient.createPost({
            channel_id: created.id,
            message: 'After disable no translation',
            user_id: createdPoster.id,
        });

        await app.page.reload();
        await expect(app.center.postCreate).toBeVisible();
        await expect(app.channelHeader.autotranslationBadgeText).not.toBeVisible();
        await expect(app.center.postList.post(afterDisablePost).message.container).toHaveText(
            'After disable no translation',
        );
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
        const welcomePost = await posterClient.createPost({
            channel_id: created.id,
            message: 'Hola para nuevo miembro',
            user_id: createdPoster.id,
        });

        await adminClient.addToChannel(user.id, created.id);
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: channelName});
        await expect(app.center.postCreate).toBeVisible();

        // * Verify translation badge is visible (indicates autotranslation is ON by default)
        await expect(app.channelHeader.autotranslationBadgeText).toBeVisible({timeout: 15000});

        // * Verify post appeared with translation (mock server appends "[translated to en]" to original)
        await expect(app.center.postList.post(welcomePost).message.container).toContainText(
            'Hola para nuevo miembro [translated to en]',
        );
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

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: channelName});
        await expect(app.center.postCreate).toBeVisible();

        const {autotranslationMenuItem} = app.channelHeader.menu;
        await app.channelHeader.openMenuButton.clickTo(autotranslationMenuItem);
        const disableModal = await autotranslationMenuItem.clickTo(app.disableAutotranslationModal);
        await disableModal.confirmButton.click();
        await expect(disableModal).not.toBeVisible();

        const ephemeralPost = await postWith(app.center.postList, {
            message: Msg.channel_header.autotranslation.disable_confirm.ephemeral_message,
        });
        await expect(ephemeralPost).toBeVisible();
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
        const revertPost = await posterClient.createPost({
            channel_id: created.id,
            message: originalText,
            user_id: createdPoster.id,
        });

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: channelName});
        await expect(app.center.postCreate).toBeVisible();

        // * Verify post with translated text appears before disabling
        // Mock server appends "[translated to en]" to the original text
        const translatedText = 'Solo texto original [translated to en]';
        const post = app.center.postList.post(revertPost);
        await expect(post.message.container).toContainText(translatedText, {timeout: 15000});

        const {autotranslationMenuItem} = app.channelHeader.menu;
        await app.channelHeader.openMenuButton.clickTo(autotranslationMenuItem);
        const disableModal = await autotranslationMenuItem.clickTo(app.disableAutotranslationModal);
        await disableModal.confirmButton.click();

        // * After disabling, the post shows its original text
        await expect(post.message.container).toHaveText(originalText, {timeout: 15000});

        // * Verify translation indicator is no longer present
        await expect(post.translationButton).not.toBeVisible();
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
        const spanishPost = await posterClient.createPost({
            channel_id: created.id,
            message: 'Solo español',
            user_id: createdPoster.id,
        });
        // English message won't be translated
        await setMockSourceLanguage(translationUrl, 'en');
        const englishPost = await posterClient.createPost({
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

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: channelName});
        await expect(app.center.postCreate).toBeVisible();

        // * Verify both posts appear
        // Mock server produces "<original> [translated to en]", not real translations
        await expect(app.center.postList.post(englishPost).message.container).toHaveText('English only', {
            timeout: 15000,
        });
        await expect(app.center.postList.post(spanishPost).message.container).toContainText(
            'Solo español [translated to en]',
        );
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
        const spanishPost = await posterClient.createPost({
            channel_id: created.id,
            message: 'Solo español',
            user_id: createdPoster.id,
        });
        // English message won't be translated
        await setMockSourceLanguage(translationUrl, 'en');
        const englishPost = await posterClient.createPost({
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

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: channelName});
        await expect(app.center.postCreate).toBeVisible();

        // * Verify posts appeared
        // Mock server produces "<original> [translated to en]", not real translations
        await expect(app.center.postList.post(englishPost).message.container).toHaveText('English only', {
            timeout: 15000,
        });
        await expect(app.center.postList.post(spanishPost).message.container).toContainText(
            'Solo español [translated to en]',
        );
    },
);
