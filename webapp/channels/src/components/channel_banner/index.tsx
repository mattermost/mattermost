// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {isEnterpriseLicense} from 'utils/license_utils';
import type {TextFormattingOptions} from 'utils/text_formatting';

import {channelBannerEnabled} from '@mattermost/types/channels';

import {getChannelBanner} from 'mattermost-redux/selectors/entities/channels';
import {getLicense} from 'mattermost-redux/selectors/entities/general';

import './style.scss';
import {getContrastingSimpleColor} from 'mattermost-redux/utils/theme_utils';

import Markdown from 'components/markdown';
import WithTooltip from 'components/with_tooltip';

import type {GlobalState} from 'types/store';

const markdownRenderingOptions: Partial<TextFormattingOptions> = {
    singleline: true,
    mentionHighlight: false,
};

type Props = {
    channelId: string;
}

export default function ChannelBanner({channelId}: Props) {
    const license = useSelector(getLicense);

    // TODO - check for premium license here once the corresponding PR is merged
    const isEnterprise = isEnterpriseLicense(license);
    const channelBannerInfo = useSelector((state: GlobalState) => getChannelBanner(state, channelId));
    const intl = useIntl();

    const showChannelBanner = isEnterprise && channelBannerEnabled(channelBannerInfo);

    if (!channelBannerInfo || !showChannelBanner) {
        return null;
    }

    const ariaLabel = intl.formatMessage({id: 'channel_banner.aria_label', defaultMessage: 'Channel banner text'});
    const content = (
        <Markdown
            message={channelBannerInfo!.text}
            options={markdownRenderingOptions}
        />
    );

    return (
        <WithTooltip
            title={content}
            className='channelBannerTooltip'
            delayClose={true}
            placement={'bottom'}
        >
            <div
                className='channel_banner'
                data-testid='channel_banner_container'
                style={{
                    backgroundColor: channelBannerInfo!.background_color,
                }}
            >
                <span
                    data-testid='channel_banner_text'
                    className='channel_banner_text'
                    aria-label={ariaLabel}
                    style={{
                        color: getContrastingSimpleColor(channelBannerInfo!.background_color),
                    }}
                >
                    {content}
                </span>
            </div>
        </WithTooltip>
    );
}
