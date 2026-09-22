// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {useIntl} from 'react-intl';

import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';
import {getContrastingSimpleColor} from 'mattermost-redux/utils/theme_utils';

import Markdown from 'components/markdown';
import SectionNotice from 'components/section_notice';

import {renderBannerTemplate} from './banner_template';

import './banner_preview.scss';

// Mirrors channel_banner.tsx: the preview is only honest if it renders the same
// markdown subset the banner itself does.
const markdownRenderingOptions = {
    singleline: true,
    mentionHighlight: false,
    atMentions: false,
};

type Props = {
    template: string;
    attributes: ResolvedChannelAttribute[];
    backgroundColor?: string;
};

/**
 * The banner as this channel's members will see it, colour included.
 */
const BannerPreview = ({template, attributes, backgroundColor}: Props) => {
    const {formatMessage} = useIntl();
    const rendered = useMemo(() => renderBannerTemplate(template, attributes), [template, attributes]);

    const style = useMemo(() => {
        if (!backgroundColor) {
            return undefined;
        }
        return {backgroundColor, color: getContrastingSimpleColor(backgroundColor)};
    }, [backgroundColor]);

    if (!rendered) {
        return (
            <div
                className='BannerPreviewSection'
                data-testid='bannerPreviewEmptyNotice'
            >
                <SectionNotice
                    type='warning'
                    title={formatMessage({
                        id: 'channel_attributes.banner.empty_notice.title',
                        defaultMessage: 'The banner will not be displayed',
                    })}
                    text={formatMessage({
                        id: 'channel_attributes.banner.empty_notice',
                        defaultMessage: 'There\'s nothing to display until the attributes in the banner text have values.',
                    })}
                />
            </div>
        );
    }

    return (
        <div className='BannerPreviewSection'>
            <div
                className='BannerPreview'
                style={style}
                data-testid='bannerAttributePreview'
                aria-live='polite'
            >
                <Markdown
                    message={rendered}
                    options={markdownRenderingOptions}
                />
            </div>
        </div>
    );
};

export default BannerPreview;
