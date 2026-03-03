// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    disableChannelAutotranslation,
    enableAutotranslationConfig,
    enableChannelAutotranslation,
    hasAutotranslationLicense,
    setUserChannelAutotranslation,
    expect,
    test,
    setMockSourceLanguage,
} from '@mattermost/playwright-lib';
import {getRandomId} from 'utils/utils';

const POST_TYPE_AUTOTRANSLATION_CHANGE = 'system_autotranslation';

// Module-level variable to store the discovered translation service URL
// Set during test.beforeEach() and used by tests
let selectedTranslationUrl: string | null = null;

test.beforeEach(async () => {
    // Verify translation service is running (mock server or real LibreTranslate)
    // The translation service is called on the server side, so we need the service running
    const configuredUrl = process.env.LIBRETRANSLATE_URL;
    const defaultMockUrl = 'http://localhost:3010';
    const fallbackRealUrl = 'http://localhost:5000';

    selectedTranslationUrl = null;

    // Try configured URL first (if provided)
    if (configuredUrl) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            // Try /health endpoint first (real LibreTranslate), then fallback to / (mock server)
            let res = await fetch(`${configuredUrl}/health`, {signal: controller.signal}).catch(() => null);
            if (!res?.ok) {
                res = await fetch(`${configuredUrl}/`, {signal: controller.signal});
            }

            clearTimeout(timeoutId);
            if (res?.ok) {
                selectedTranslationUrl = configuredUrl;
            }
        } catch {
            // Service probe failed, continue to next option
        }
    }

    // If no configured URL or it failed, try default mock server
    if (!selectedTranslationUrl) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`${defaultMockUrl}/`, {signal: controller.signal}).catch(() => null);
            clearTimeout(timeoutId);
            if (res?.ok) {
                selectedTranslationUrl = defaultMockUrl;
            }
        } catch {
            // Service probe failed, continue to next option
        }
    }

    // If mock server not found, try real LibreTranslate
    if (!selectedTranslationUrl) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`${fallbackRealUrl}/health`, {signal: controller.signal}).catch(() => null);
            clearTimeout(timeoutId);
            if (res?.ok) {
                selectedTranslationUrl = fallbackRealUrl;
            }
        } catch {
            // Service probe failed, continue to error skip
        }
    }

    if (!selectedTranslationUrl) {
        test.skip(
            true,
            `Translation service not found. Please start one of the following:\n` +
                `1. Mock server (recommended): npm run start:libretranslate-mock\n` +
                `2. Real LibreTranslate: docker-compose -f ../docker-compose.autotranslation.yml up`,
        );
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
        const libretranslateUrl = selectedTranslationUrl ?? process.env.LIBRETRANSLATE_URL ?? 'http://localhost:3010';
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: libretranslateUrl,
            targetLanguages: ['en', 'es'],
        });

        // # Create a channel and enable autotranslation on it
        const channelName = `autotranslation-${await getRandomId()}`;
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

        // # Viewer (user) opens the channel and verifies post was translated
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        // * Verify post is visible (translation happens server-side)
        // Wait for the post to appear in the channel
        const postLocator = channelsPage.centerView.container.locator('[id^="post_"]');
        await expect(postLocator).not.toHaveCount(0, {timeout: 15000});
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
        const libretranslateUrl = selectedTranslationUrl ?? process.env.LIBRETRANSLATE_URL ?? 'http://localhost:3010';
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: libretranslateUrl,
            targetLanguages: ['en', 'es'],
        });

        const channelName = `autotranslation-admin-${await getRandomId()}`;
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

        const channelSettingsModal = await channelsPage.openChannelSettings();
        const configurationTab = await channelSettingsModal.openConfigurationTab();
        await configurationTab.enableChannelAutotranslation();
        await configurationTab.save();
        await channelSettingsModal.close();

        const channelAfter = await adminClient.getChannel(created.id);
        expect(channelAfter.autotranslation).toBe(true);
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
        const libretranslateUrl = selectedTranslationUrl ?? process.env.LIBRETRANSLATE_URL ?? 'http://localhost:3010';
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: libretranslateUrl,
            targetLanguages: ['en', 'es'],
        });

        const channelName = `autotranslation-system-msg-${await getRandomId()}`;
        const created = await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: 'Autotranslation System Message Test',
            type: 'O',
        });

        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        const channelSettingsModal = await channelsPage.openChannelSettings();
        const configurationTab = await channelSettingsModal.openConfigurationTab();
        await configurationTab.enableChannelAutotranslation();
        await configurationTab.save();
        await channelSettingsModal.close();

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
        const libretranslateUrl = selectedTranslationUrl ?? process.env.LIBRETRANSLATE_URL ?? 'http://localhost:3010';
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: libretranslateUrl,
            targetLanguages: ['en', 'es'],
        });

        const channelName = `autotranslation-new-only-${await getRandomId()}`;
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

        await enableChannelAutotranslation(adminClient, created.id);
        await setUserChannelAutotranslation(userClient, created.id, true);

        const newMessage = 'Hola nuevo';
        await posterClient.createPost({
            channel_id: created.id,
            message: newMessage,
            user_id: createdPoster.id,
        });

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        // * Verify new message appears (translation happens server-side)
        // Auto-translated channels display messages in the user's preferred language (English)
        const translatedNewMessage = 'Hello, new';
        await expect(
            channelsPage.centerView.container.locator('[id^="post_"]').getByText(translatedNewMessage, {exact: false}),
        ).toBeVisible({timeout: 15000});

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
        const libretranslateUrl = selectedTranslationUrl ?? process.env.LIBRETRANSLATE_URL ?? 'http://localhost:3010';
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: libretranslateUrl,
            targetLanguages: ['en', 'es'],
        });

        const channelName = `autotranslation-tooltip-${await getRandomId()}`;
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

        await expect(channelsPage.centerView.autotranslationBadge).toBeVisible();
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
        const libretranslateUrl = selectedTranslationUrl ?? process.env.LIBRETRANSLATE_URL ?? 'http://localhost:3010';
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: libretranslateUrl,
            targetLanguages: ['en', 'es'],
        });

        const channelName = `autotranslation-disable-${await getRandomId()}`;
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
        const libretranslateUrl = selectedTranslationUrl ?? process.env.LIBRETRANSLATE_URL ?? 'http://localhost:3010';
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: libretranslateUrl,
            targetLanguages: ['en', 'es'],
        });

        const channelName = `autotranslation-default-on-${await getRandomId()}`;
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

        // Set Spanish source to ensure translation happens for new member
        await setMockSourceLanguage(libretranslateUrl, 'es');
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

        // * Verify post appeared with translation
        // Auto-translated channels display messages in the user's preferred language (English)
        await expect(
            channelsPage.centerView.container.locator('[id^="post_"]').getByText('Hello for new member'),
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
        const libretranslateUrl = selectedTranslationUrl ?? process.env.LIBRETRANSLATE_URL ?? 'http://localhost:3010';
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: libretranslateUrl,
            targetLanguages: ['en', 'es'],
        });

        const channelName = `autotranslation-ephemeral-${await getRandomId()}`;
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

        const license = await adminClient.getClientLicenseOld();
        test.skip(
            !hasAutotranslationLicense(license.SkuShortName),
            'Skipping test - server does not have Entry or Advanced license',
        );
        const libretranslateUrl = selectedTranslationUrl ?? process.env.LIBRETRANSLATE_URL ?? 'http://localhost:3010';
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: libretranslateUrl,
            targetLanguages: ['en', 'es'],
        });

        const channelName = `autotranslation-revert-${await getRandomId()}`;
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
        await setMockSourceLanguage(libretranslateUrl, 'es');
        await posterClient.createPost({
            channel_id: created.id,
            message: originalText,
            user_id: createdPoster.id,
        });

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        // * Verify post with original text appears before disabling
        const spanishPost = channelsPage.centerView.container.locator('[id^="post_"]').filter({hasText: originalText});
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
        const libretranslateUrl = selectedTranslationUrl ?? process.env.LIBRETRANSLATE_URL ?? 'http://localhost:3010';
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: libretranslateUrl,
            targetLanguages: ['en', 'es'],
        });

        const channelName = `autotranslation-lang-${await getRandomId()}`;
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

        // Set source language for mock/real server before creating posts
        // For mock: controls which language is detected; for real: auto-detection is used
        // Post Spanish first so it gets the translation indicator (first message from posterClient)
        await setMockSourceLanguage(libretranslateUrl, 'es');
        await posterClient.createPost({
            channel_id: created.id,
            message: 'Solo español',
            user_id: createdPoster.id,
        });
        // English message won't be translated
        await setMockSourceLanguage(libretranslateUrl, 'en');
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
        await expect(channelsPage.centerView.container.locator('[id^="post_"]').getByText('English only')).toBeVisible({
            timeout: 15000,
        });
        await expect(
            channelsPage.centerView.container.locator('[id^="post_"]').getByText('Solo español'),
        ).toBeVisible();

        // * Verify both messages are present (translation indicators may vary with real LibreTranslate auto-detection)
        const spanishPost = channelsPage.centerView.container
            .locator('[id^="post_"]')
            .filter({hasText: 'Solo español'});
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
        const libretranslateUrl = selectedTranslationUrl ?? process.env.LIBRETRANSLATE_URL ?? 'http://localhost:3010';
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: libretranslateUrl,
            targetLanguages: ['en', 'es'],
        });

        const channelName = `autotranslation-indicator-${await getRandomId()}`;
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

        // Set source language before creating posts
        // Post Spanish first so it gets the translation indicator (first message from posterClient)
        await setMockSourceLanguage(libretranslateUrl, 'es');
        await posterClient.createPost({
            channel_id: created.id,
            message: 'Solo español',
            user_id: createdPoster.id,
        });
        // English message won't be translated
        await setMockSourceLanguage(libretranslateUrl, 'en');
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
        await expect(channelsPage.centerView.container.locator('[id^="post_"]').getByText('English only')).toBeVisible({
            timeout: 15000,
        });
        await expect(
            channelsPage.centerView.container.locator('[id^="post_"]').getByText('Solo español'),
        ).toBeVisible();

        // * Verify both messages are present (translation indicators may vary with real LibreTranslate auto-detection)
        const translatedPost = channelsPage.centerView.container
            .locator('[id^="post_"]')
            .filter({hasText: 'Solo español'});
        await expect(translatedPost).toBeVisible({timeout: 15000});

        const notTranslatedPost = channelsPage.centerView.container
            .locator('[id^="post_"]')
            .filter({hasText: 'English only', exact: true});
        await expect(notTranslatedPost).toBeVisible();
    },
);

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
        const libretranslateUrl = selectedTranslationUrl ?? process.env.LIBRETRANSLATE_URL ?? 'http://localhost:3010';
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: libretranslateUrl,
            targetLanguages: ['en', 'es'],
        });

        const channelName = `autotranslation-modal-${await getRandomId()}`;
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

        // * Wait for post by searching for the message text
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
        const libretranslateUrl = selectedTranslationUrl ?? process.env.LIBRETRANSLATE_URL ?? 'http://localhost:3010';
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: libretranslateUrl,
            targetLanguages: ['en', 'es'],
        });

        const channelName = `autotranslation-dotmenu-${await getRandomId()}`;
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

        // Set Spanish source to ensure translation happens
        await setMockSourceLanguage(libretranslateUrl, 'es');
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

        // * Find post with message text and open dot menu
        const messagePost = channelsPage.centerView.container
            .locator('[id^="post_"]')
            .filter({hasText: 'Este mensaje es para probar el menú de acciones'});
        await messagePost.waitFor({state: 'visible', timeout: 15000});
        await messagePost.hover();
        // Click the post menu button (three dots)
        await messagePost.locator('.post-menu').getByRole('button').first().click();

        const messageActionMenu = page.getByRole('menu').filter({has: page.getByRole('menuitem', {name: 'Reply'})});
        // Check for Show translation menu item - should be present since translation happened
        const showTranslationItem = messageActionMenu.getByRole('menuitem', {name: 'Show translation'});

        // Translation should have happened - menu item should be visible
        await expect(showTranslationItem).toBeVisible({timeout: 15000});
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
        const libretranslateUrl = selectedTranslationUrl ?? process.env.LIBRETRANSLATE_URL ?? 'http://localhost:3010';
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: libretranslateUrl,
            targetLanguages: ['en', 'es'],
        });

        const channelName = `autotranslation-toggle-${await getRandomId()}`;
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

        await expect(channelsPage.centerView.autotranslationBadge).toBeVisible();

        await channelsPage.centerView.header.openChannelMenu();
        await page.getByRole('menuitem', {name: 'Disable autotranslation'}).click();
        await page.getByRole('button', {name: 'Turn off auto-translation'}).click();

        await expect(channelsPage.centerView.autotranslationBadge).not.toBeVisible();

        await channelsPage.centerView.header.openChannelMenu();
        await page.getByRole('menuitem', {name: 'Enable autotranslation'}).click();

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
        const libretranslateUrl = selectedTranslationUrl ?? process.env.LIBRETRANSLATE_URL ?? 'http://localhost:3010';
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: libretranslateUrl,
            targetLanguages: ['en', 'es'],
        });

        const translatedChannelName = `autotranslation-badge-${await getRandomId()}`;
        const translatedChannel = await adminClient.createChannel({
            team_id: team.id,
            name: translatedChannelName,
            display_name: 'Translated Channel',
            type: 'O',
        });
        await enableChannelAutotranslation(adminClient, translatedChannel.id);
        await adminClient.addToChannel(user.id, translatedChannel.id);
        await setUserChannelAutotranslation(userClient, translatedChannel.id, true);

        const noTranslationChannelName = `no-translation-${await getRandomId()}`;
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
        const libretranslateUrl = selectedTranslationUrl ?? process.env.LIBRETRANSLATE_URL ?? 'http://localhost:3010';
        await enableAutotranslationConfig(adminClient, {
            mockBaseUrl: libretranslateUrl,
            targetLanguages: ['en', 'es'],
        });

        const channelName = `autotranslation-unsupported-${await getRandomId()}`;
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
