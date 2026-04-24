// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {setupChannelWithConfigurationTab} from './support';

test('Should render text with descenders without clipping', async ({pw}) => {
    const {channelsPage, channelSettingsModal, configurationTab} = await setupChannelWithConfigurationTab(pw);

    await configurationTab.enableChannelBanner();
    await configurationTab.setChannelBannerTextColor('77DD88');
    // Characters with descenders (parts that extend below the baseline).
    // Previously clipped because line-height equalled font-size (13px), leaving
    // no room below the baseline for g, j, p, q, y etc.
    await configurationTab.setChannelBannerText('YyGgQqJj');
    await configurationTab.save();
    await channelSettingsModal.close();

    await channelsPage.centerView.assertChannelBannerTextNotClipped();
});

test('Should render markdown', async ({pw}) => {
    const {channelsPage, channelSettingsModal, configurationTab} = await setupChannelWithConfigurationTab(pw);

    await configurationTab.enableChannelBanner();
    await configurationTab.setChannelBannerText('**bold** *italic* ~~strikethrough~~');
    await configurationTab.setChannelBannerTextColor('77DD88');

    await configurationTab.save();
    await channelSettingsModal.close();

    await channelsPage.centerView.assertChannelBannerHasBoldText('bold');
    await channelsPage.centerView.assertChannelBannerHasItalicText('italic');
    await channelsPage.centerView.assertChannelBannerHasStrikethroughText('strikethrough');
});
