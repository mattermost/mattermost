// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {enableChannelAutotranslation, setUserChannelAutotranslation, expect, test} from '@mattermost/playwright-lib';

import {setupAutotranslationConfig, skipIfNoAutotranslationLicense} from './support';

test(
    'autotranslation badge is only visible on translated channels',
    {
        tag: ['@autotranslation'],
    },
    async ({pw}) => {
        const {adminClient, user, userClient, team} = await pw.initSetup();

        await skipIfNoAutotranslationLicense(adminClient);
        await setupAutotranslationConfig(adminClient);

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

        await skipIfNoAutotranslationLicense(adminClient);
        await setupAutotranslationConfig(adminClient);

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
