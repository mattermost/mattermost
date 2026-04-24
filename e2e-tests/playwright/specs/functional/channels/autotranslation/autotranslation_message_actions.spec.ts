// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    ChannelsPost,
    enableChannelAutotranslation,
    setUserChannelAutotranslation,
    expect,
    test,
    setMockSourceLanguage,
} from '@mattermost/playwright-lib';

import {setupAutotranslationConfig, skipIfNoAutotranslationLicense} from './support';

test(
    'message actions include Show translation',
    {
        tag: ['@autotranslation'],
    },
    async ({pw}) => {
        const {adminClient, user, userClient, team} = await pw.initSetup();

        await skipIfNoAutotranslationLicense(adminClient);
        const translationUrl = await setupAutotranslationConfig(adminClient);

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

        await skipIfNoAutotranslationLicense(adminClient);
        await setupAutotranslationConfig(adminClient);

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
