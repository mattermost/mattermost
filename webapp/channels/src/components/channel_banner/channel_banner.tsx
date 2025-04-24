// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useRef} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {selectShowChannelBanner} from 'mattermost-redux/selectors/entities/channel_banner';
import {getChannelBanner} from 'mattermost-redux/selectors/entities/channels';
import {getContrastingSimpleColor} from 'mattermost-redux/utils/theme_utils';

import Markdown from 'components/markdown';
import WithTooltip from 'components/with_tooltip';

import type {TextFormattingOptions} from 'utils/text_formatting';

import type {GlobalState} from 'types/store';

import './style.scss';

const markdownRenderingOptions: Partial<TextFormattingOptions> = {
    singleline: true,
    mentionHighlight: false,
};

type Props = {
    channelId: string;
}

export default function ChannelBanner({channelId}: Props) {
    const channelBannerInfo = useSelector((state: GlobalState) => getChannelBanner(state, channelId));
    const showChannelBanner = useSelector((state: GlobalState) => selectShowChannelBanner(state, channelId));
    const textContainerRef = useRef<HTMLSpanElement>(null);
    const [tooltipNeeded, setTooltipNeeded] = React.useState<boolean>(false);

    useEffect(() => {
        if (!textContainerRef.current) {
            return;
        }

        const isOverflowingHorizontally = textContainerRef.current.offsetWidth < textContainerRef.current.scrollWidth;
        const isOverflowingVertically = textContainerRef.current.offsetHeight < textContainerRef.current.scrollHeight;

        setTooltipNeeded(isOverflowingHorizontally || isOverflowingVertically);
    }, [channelBannerInfo?.text]);

    const intl = useIntl();
    const channelBannerTextAriaLabel = intl.formatMessage({id: 'channel_banner.aria_label', defaultMessage: 'Channel banner text'});

    const content = (
        <Markdown
            message={channelBannerInfo?.text}
            options={markdownRenderingOptions}
        />
    );

    const channelBannerStyle = useMemo(() => {
        return {
            backgroundColor: channelBannerInfo?.background_color,
        };
    }, [channelBannerInfo]);

    const channelBannerTextStyle = useMemo(() => {
        // this is just to satisfy type checks.
        if (!channelBannerInfo || !channelBannerInfo.background_color) {
            return {};
        }

        const color = getContrastingSimpleColor(channelBannerInfo.background_color);

        // The CSS variable is declared here, and is being used in the stylesheet being imported in this component.
        // This is needed because if the user sets background color a share of blue similar to the default link color,
        // the markdown link will become almost invisible. So, the CSS variable declared here is used
        // to set the color of the text in anchor tag in the stylesheet.
        return {
            color,
            '--channel-banner-text-color': color,
        };
    }, [channelBannerInfo]);

    if (!channelBannerInfo || !showChannelBanner) {
        return null;
    }

    return (
        <WithTooltip
            title={content}
            className='channelBannerTooltip'
            delayClose={true}
            forcedPlacement='bottom'
            disabled={!tooltipNeeded}
        >
            <div
                className='channel_banner'
                data-testid='channel_banner_container'
                style={channelBannerStyle}
            >
                <span
                    data-testid='channel_banner_text'
                    className='channel_banner_text'
                    aria-label={channelBannerTextAriaLabel}
                    style={channelBannerTextStyle}
                    ref={textContainerRef}
                >
                    {content}
                </span>
            </div>
        </WithTooltip>
    );
}
