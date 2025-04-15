// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {channelBannerEnabled} from '@mattermost/types/channels';
import type {GlobalState} from '@mattermost/types/store';

import {General} from 'mattermost-redux/constants';
import {getChannel, getChannelBanner} from 'mattermost-redux/selectors/entities/channels';
import {getLicense} from 'mattermost-redux/selectors/entities/general';

export const selectShowChannelBanner = (state: GlobalState, channelId: string): boolean => {
    const license = getLicense(state);

    const isPremiumLicense = license?.SkuShortName === General.SKUPremium;
    const channelBannerInfo = getChannelBanner(state, channelId);
    const channel = getChannel(state, channelId);
    const isValidChannelType = Boolean(channel && (channel.type === General.OPEN_CHANNEL || channel.type === General.PRIVATE_CHANNEL));
    return isPremiumLicense && isValidChannelType && channelBannerEnabled(channelBannerInfo);
};
