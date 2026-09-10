// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage} from 'react-intl';

import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';
import {getContrastingSimpleColor} from 'mattermost-redux/utils/theme_utils';

import Markdown from 'components/markdown';

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
    const rendered = useMemo(() => renderBannerTemplate(template, attributes), [template, attributes]);

    const style = useMemo(() => {
        if (!backgroundColor) {
            return undefined;
        }
        return {backgroundColor, color: getContrastingSimpleColor(backgroundColor)};
    }, [backgroundColor]);

    return (
        <div
            className='BannerPreview'
            style={style}
            data-testid='bannerAttributePreview'
            aria-live='polite'
        >
            {rendered ? (
                <Markdown
                    message={rendered}
                    options={markdownRenderingOptions}
                />
            ) : (

                // An all-unset template resolves to nothing; say so rather than render
                // an empty bar that reads as a bug.
                <span className='BannerPreview__empty'>
                    <FormattedMessage
                        id='channel_attributes.banner.renders_as_empty'
                        defaultMessage='nothing yet — no values are set'
                    />
                </span>
            )}
        </div>
    );
};

export default BannerPreview;
