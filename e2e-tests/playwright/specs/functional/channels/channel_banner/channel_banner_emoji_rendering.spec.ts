// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {setupChannelWithConfigurationTab} from './support';

const EMOJI_SIZE = 16;

test('Should render image emoticons without clipping', async ({pw}) => {
    const {channelsPage, channelSettingsModal, configurationTab} = await setupChannelWithConfigurationTab(pw);

    await configurationTab.enableChannelBanner();
    await configurationTab.setChannelBannerTextColor('77DD88');
    // :dog: is in Mattermost's emoji map → renders as .emoticon (background-image).
    // Unicode emojis that are also in the map (e.g. 🐶) follow the same path.
    await configurationTab.setChannelBannerText('Hello :dog:');
    await configurationTab.save();
    await channelSettingsModal.close();

    await channelsPage.centerView.assertChannelBannerImageEmojiSize(EMOJI_SIZE);
});

test('Should render unsupported unicode emoji without clipping', async ({pw}) => {
    const {channelsPage, channelSettingsModal, configurationTab} = await setupChannelWithConfigurationTab(pw);

    await configurationTab.enableChannelBanner();
    await configurationTab.setChannelBannerTextColor('77DD88');
    // 🫠 (U+1FAE0, Unicode 14.0) is above Mattermost's emoji map ceiling (1FAD6)
    // so it falls through to the .emoticon--unicode span path.
    await configurationTab.setChannelBannerText('Hello 🫠');
    await configurationTab.save();
    await channelSettingsModal.close();

    await channelsPage.centerView.assertChannelBannerUnicodeEmojiSize(EMOJI_SIZE);
});
