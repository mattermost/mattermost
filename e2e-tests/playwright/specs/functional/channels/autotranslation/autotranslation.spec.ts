// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    disableAutotranslationConfig,
    disableChannelAutotranslation,
    enableAutotranslationConfig,
    enableChannelAutotranslation,
    ensureAutotranslationPermissions,
    getAdminClient,
    hasAutotranslationLicense,
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

test(
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

test(
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
        if (!posterClient) throw new Error('Failed to create poster client');

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
        await expect(channelsPage.centerView.container.locator('[id^="post_"]').getByText(oldMessage)).toBeVisible();
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

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        // Re-apply config + reload so the browser reads the latest AutoTranslationSettings,
        // not state clobbered by a concurrent initSetup() → updateConfig(defaultConfig).
        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
        await channelsPage.page.reload();
        await channelsPage.toBeVisible();

        await expect(channelsPage.centerView.autotranslationBadge).toBeVisible({timeout: 15000});
        await channelsPage.centerView.autotranslationBadge.hover();
        await expect(page.getByRole('tooltip')).toContainText('Auto-translation is enabled');
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
        if (!posterClient) throw new Error('Failed to create poster client');

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
        await expect(
            channelsPage.centerView.container.getByText('After disable no translation', {exact: true}),
        ).toBeVisible();
    },
);
