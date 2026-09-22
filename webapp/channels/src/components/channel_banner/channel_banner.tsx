// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useRef} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {ChannelBanner} from '@mattermost/types/channels';

import {selectShowChannelBanner} from 'mattermost-redux/selectors/entities/channel_banner';
import {getChannelBanner} from 'mattermost-redux/selectors/entities/channels';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getContrastingSimpleColor} from 'mattermost-redux/utils/theme_utils';

import {hasAttributeTokens, renderBannerTemplate} from 'components/channel_attributes/banner_template';
import useChannelAttributes from 'components/common/hooks/useChannelAttributes';
import useChannelClassificationBanner from 'components/common/hooks/useChannelClassificationBanner';
import useResolvedChannelAttributes from 'components/common/hooks/useResolvedChannelAttributes';
import Markdown from 'components/markdown';

import {isMinimumEnterpriseAdvancedLicense} from 'utils/license_utils';
import type {TextFormattingOptions} from 'utils/text_formatting';

import type {GlobalState} from 'types/store';

import './style.scss';

const markdownRenderingOptions: Partial<TextFormattingOptions> = {
    singleline: true,
    mentionHighlight: false,
};

type Props = {
    channelId: string;
};

export default function ChannelBanner({channelId}: Props) {
    const channelBannerInfo = useSelector((state: GlobalState) => getChannelBanner(state, channelId));
    const license = useSelector(getLicense);
    const licenseEnabled = isMinimumEnterpriseAdvancedLicense(license);
    const channelBannerConfigured = useSelector((state: GlobalState) => selectShowChannelBanner(state, channelId));
    const showNativeBanner = licenseEnabled && channelBannerConfigured;

    const {enabled: channelAttributesEnabled} = useChannelAttributes();
    const resolvedAttributes = useResolvedChannelAttributes(channelId);
    const classificationBanner = useChannelClassificationBanner(channelId);

    // Classification property value takes priority over native banner_info
    const effectiveBanner: ChannelBanner | undefined = classificationBanner.hasClassification ?
        classificationBanner.classificationBanner :
        channelBannerInfo;

    const showBanner = classificationBanner.hasClassification || showNativeBanner;

    // Never surface raw "{{attribute}}" tokens: resolve them here as well as in the
    // classification hook, so a native-banner fallback cannot leak the template.
    const bannerText = useMemo(() => {
        const raw = effectiveBanner?.text?.trim() ?? '';
        if (!raw) {
            return '';
        }
        if (channelAttributesEnabled && hasAttributeTokens(raw)) {
            return renderBannerTemplate(raw, resolvedAttributes).trim();
        }
        return raw;
    }, [channelAttributesEnabled, effectiveBanner?.text, resolvedAttributes]);

    const textContainerRef = useRef<HTMLSpanElement>(null);
    const [tooltipNeeded, setTooltipNeeded] = React.useState<boolean>(false);

    useEffect(() => {
        if (!textContainerRef.current) {
            return;
        }

        const isOverflowingHorizontally = textContainerRef.current.offsetWidth < textContainerRef.current.scrollWidth;
        const isOverflowingVertically = textContainerRef.current.offsetHeight < textContainerRef.current.scrollHeight;

        setTooltipNeeded(isOverflowingHorizontally || isOverflowingVertically);
    }, [bannerText]);

    const intl = useIntl();
    const channelBannerTextAriaLabel = intl.formatMessage({id: 'channel_banner.aria_label', defaultMessage: 'Channel banner text'});

    const content = (
        <Markdown
            message={bannerText}
            options={markdownRenderingOptions}
        />
    );

    const channelBannerStyle = useMemo(() => {
        return {
            backgroundColor: effectiveBanner?.background_color,
        };
    }, [effectiveBanner]);

    const channelBannerTextStyle = useMemo(() => {
        if (!effectiveBanner || !effectiveBanner.background_color) {
            return {};
        }

        const color = getContrastingSimpleColor(effectiveBanner.background_color);

        // The CSS variable is declared here, and is being used in the stylesheet being imported in this component.
        // This is needed because if the user sets background color a share of blue similar to the default link color,
        // the markdown link will become almost invisible. So, the CSS variable declared here is used
        // to set the color of the text in anchor tag in the stylesheet.
        return {
            color,
            '--channel-banner-text-color': color,
        };
    }, [effectiveBanner]);

    // Nothing to show: an enabled banner with empty text is a coloured empty strip.
    if (!effectiveBanner || !showBanner || !bannerText) {
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
