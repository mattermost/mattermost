// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {isEnterpriseLicense} from 'utils/license_utils';

import {channelBannerEnabled} from '@mattermost/types/channels';

import {getChannelBanner} from 'mattermost-redux/selectors/entities/channels';
import {getLicense} from 'mattermost-redux/selectors/entities/general';

import './style.scss';
import {getContrastingSimpleColor} from 'mattermost-redux/utils/theme_utils';

import Markdown from 'components/markdown';

import type {GlobalState} from 'types/store';

const options = {
    singleline: true,
    mentionHighlight: false,
};

type Props = {
    channelId: string;
}

export default function ChannelBanner({channelId}: Props) {
    const license = useSelector(getLicense);
    const isEnterprise = isEnterpriseLicense(license);
    const channelBannerInfo = useSelector((state: GlobalState) => getChannelBanner(state, channelId));
    const intl = useIntl();

    const showChannelBanner = isEnterprise && channelBannerEnabled(channelBannerInfo);
    if (!showChannelBanner) {
        return null;
    }

    const ariaLabel = intl.formatMessage({id: 'channel_banner.aria_label', defaultMessage: 'Channel banner text'});

    return (
        <div
            className='channel_banner'
            style={{
                backgroundColor: channelBannerInfo!.background_color,
            }}
        >
            <span
                className='channel_banner_text'
                aria-label={ariaLabel}
                style={{
                    color: getContrastingSimpleColor(channelBannerInfo!.background_color),
                }}
            >
                <Markdown
                    message={channelBannerInfo!.text}
                    options={options}
                />
            </span>
        </div>
    );
}
