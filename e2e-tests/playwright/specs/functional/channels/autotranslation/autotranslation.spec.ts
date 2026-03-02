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
} from '@mattermost/playwright-lib';
import {getRandomId} from 'utils/utils';
import {setMockSourceLanguage} from '@mattermost/playwright-lib';

const POST_TYPE_AUTOTRANSLATION_CHANGE = 'system_autotranslation';

test.beforeEach(async () => {
    // Verify translation service is running (mock server or real LibreTranslate)
    // The translation service is called on the server side, so we need the service running
    const configuredUrl = process.env.LIBRETRANSLATE_URL;
    const defaultMockUrl = 'http://localhost:3010';
    const fallbackRealUrl = 'http://localhost:5000';

    let selectedUrl: string | null = null;
    let lastError: string | null = null;

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
                selectedUrl = configuredUrl;
            }
        } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
        }
    }

    // If no configured URL or it failed, try default mock server
    if (!selectedUrl) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`${defaultMockUrl}/`, {signal: controller.signal}).catch(() => null);
            clearTimeout(timeoutId);
            if (res?.ok) {
                selectedUrl = defaultMockUrl;
            }
        } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
        }
    }

    // If mock server not found, try real LibreTranslate
    if (!selectedUrl) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`${fallbackRealUrl}/health`, {signal: controller.signal}).catch(() => null);
            clearTimeout(timeoutId);
            if (res?.ok) {
                selectedUrl = fallbackRealUrl;
            }
        } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
        }
    }

    if (!selectedUrl) {
        test.skip(
            true,
            `Translation service not found. Please start one of the following:\n` +
                `1. Mock server (recommended): npm run start:libretranslate-mock\n` +
                `2. Real LibreTranslate: docker-compose -f ../docker-compose.autotranslation.yml up\n` +
                `Error: ${lastError}`,
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
        // Use the LibreTranslate service URL for translation
        const libretranslateUrl = process.env.LIBRETRANSLATE_URL || 'http://localhost:3010';
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

        // # Viewer (user) opens the channel and waits for translated post
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        // * Mock returns "[en] Hola mundo" for target language "en"
        await channelsPage.centerView.waitUntilLastPostContains('[en] ' + message, 15000);
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
        const libretranslateUrl = process.env.LIBRETRANSLATE_URL || 'http://localhost:3010';
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
        const libretranslateUrl = process.env.LIBRETRANSLATE_URL || 'http://localhost:3010';
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
        const libretranslateUrl = process.env.LIBRETRANSLATE_URL || 'http://localhost:3010';
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

        await channelsPage.centerView.waitUntilLastPostContains('[en] ' + newMessage, 15000);
        await expect(channelsPage.centerView.container.getByText(oldMessage)).toBeVisible();
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
        const libretranslateUrl = process.env.LIBRETRANSLATE_URL || 'http://localhost:3010';
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
        const libretranslateUrl = process.env.LIBRETRANSLATE_URL || 'http://localhost:3010';
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
        await channelsPage.centerView.waitUntilLastPostContains('[en]', 15000);
        await expect(channelsPage.centerView.autotranslationBadge).toBeVisible();

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
        const libretranslateUrl = process.env.LIBRETRANSLATE_URL || 'http://localhost:3010';
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

        await posterClient.createPost({
            channel_id: created.id,
            message: 'Hola para nuevo miembro',
            user_id: createdPoster.id,
        });

        await adminClient.addToChannel(user.id, created.id);
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        await expect(channelsPage.centerView.autotranslationBadge).toBeVisible();
        await expect(
            channelsPage.centerView.container.getByText('[en] Hola para nuevo miembro', {exact: true}),
        ).toBeVisible({timeout: 15000});
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
        const libretranslateUrl = process.env.LIBRETRANSLATE_URL || 'http://localhost:3010';
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
        const libretranslateUrl = process.env.LIBRETRANSLATE_URL || 'http://localhost:3010';
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
        await posterClient.createPost({
            channel_id: created.id,
            message: originalText,
            user_id: createdPoster.id,
        });

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();
        await channelsPage.centerView.waitUntilLastPostContains('[en]', 15000);

        await channelsPage.centerView.header.openChannelMenu();
        await page.getByRole('menuitem', {name: 'Disable autotranslation'}).click();
        await page.getByRole('button', {name: 'Turn off auto-translation'}).click();

        await expect(
            channelsPage.centerView.container.locator('p').getByText(originalText, {exact: true}),
        ).toBeVisible();
        await expect(
            channelsPage.centerView.container.locator('p').getByText('[en] ' + originalText, {exact: true}),
        ).not.toBeVisible();
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
        const libretranslateUrl = process.env.LIBRETRANSLATE_URL || 'http://localhost:3010';
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

        // Set source language for mock server before creating posts
        await setMockSourceLanguage(libretranslateUrl, 'en');
        await posterClient.createPost({
            channel_id: created.id,
            message: 'English only',
            user_id: createdPoster.id,
        });
        await setMockSourceLanguage(libretranslateUrl, 'es');
        await posterClient.createPost({
            channel_id: created.id,
            message: 'Solo español',
            user_id: createdPoster.id,
        });

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        await channelsPage.centerView.waitUntilLastPostContains('[en] Solo español', 15000);
        await expect(channelsPage.centerView.container.getByText('English only')).toBeVisible();
        await expect(channelsPage.centerView.container.getByText('[en] English only')).not.toBeVisible();
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
        const libretranslateUrl = process.env.LIBRETRANSLATE_URL || 'http://localhost:3010';
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

        // Set source language for mock server before creating posts
        await setMockSourceLanguage(libretranslateUrl, 'en');
        await posterClient.createPost({
            channel_id: created.id,
            message: 'English only',
            user_id: createdPoster.id,
        });
        await setMockSourceLanguage(libretranslateUrl, 'es');
        await posterClient.createPost({
            channel_id: created.id,
            message: 'Solo español',
            user_id: createdPoster.id,
        });

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        await channelsPage.centerView.waitUntilLastPostContains('[en] Solo español', 15000);
        const translatedPost = channelsPage.centerView.container
            .locator('[id^="post_"]')
            .filter({hasText: '[en] Solo español'});
        await expect(translatedPost.getByRole('button', {name: 'This post has been translated'})).toBeVisible();
        const notTranslatedPost = channelsPage.centerView.container
            .locator('[id^="post_"]')
            .filter({hasText: 'English only', exact: true});
        expect(notTranslatedPost).toBeVisible();
        await expect(notTranslatedPost.getByRole('button', {name: 'This post has been translated'})).not.toBeVisible();
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
        const libretranslateUrl = process.env.LIBRETRANSLATE_URL || 'http://localhost:3010';
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

        await posterClient.createPost({
            channel_id: created.id,
            message: 'Texto para modal',
            user_id: createdPoster.id,
        });

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        await channelsPage.centerView.waitUntilLastPostContains('[en]', 15000);
        const translatedPost = channelsPage.centerView.container
            .locator('[id^="post_"]')
            .filter({hasText: '[en] Texto para modal'});
        await expect(translatedPost.getByRole('button', {name: 'This post has been translated'})).toBeVisible();
        await translatedPost.getByRole('button', {name: 'This post has been translated'}).click();

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
        const libretranslateUrl = process.env.LIBRETRANSLATE_URL || 'http://localhost:3010';
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

        await posterClient.createPost({
            channel_id: created.id,
            message: 'Mensaje para menú',
            user_id: createdPoster.id,
        });

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        await channelsPage.centerView.waitUntilLastPostContains('[en]', 15000);
        const lastPost = await channelsPage.centerView.getLastPost();
        await lastPost.hover();
        await lastPost.postMenu.openDotMenu();
        await page.keyboard.press('Escape');
        const messageActionMenu = page.getByRole('menu').filter({has: page.getByRole('menuitem', {name: 'Reply'})});
        await expect(messageActionMenu.getByRole('menuitem', {name: 'Show translation'})).toBeVisible();
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
        const libretranslateUrl = process.env.LIBRETRANSLATE_URL || 'http://localhost:3010';
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
        const libretranslateUrl = process.env.LIBRETRANSLATE_URL || 'http://localhost:3010';
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
        const libretranslateUrl = process.env.LIBRETRANSLATE_URL || 'http://localhost:3010';
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
