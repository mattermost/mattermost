// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {CSSProperties} from 'react';
import {useSelector} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import ExternalLink from 'components/external_link';

import {isImageProxyURL, isUrlSafe, unwrapImageProxyURL} from 'utils/url';

import type {GlobalState} from 'types/store';

const TRUNCATED_STYLE: CSSProperties = {
    display: 'inline-block',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
};

type Props = {
    src: string;
    alt?: string;
    title?: string;
    className?: string;
    location: string;
    disableLink?: boolean;
    inline?: boolean;
};

const BlockedImageLink = ({
    src,
    alt,
    title,
    className,
    location,
    disableLink,
    inline,
}: Props) => {
    const siteURL = useSelector((state: GlobalState) => getConfig(state).SiteURL);
    const targetUrl = unwrapImageProxyURL(src, siteURL);
    const label = alt || targetUrl;
    const isInline = inline ?? location === 'markdown_image';
    const style = isInline ? undefined : TRUNCATED_STYLE;

    if (disableLink || !isUrlSafe(targetUrl) || isImageProxyURL(targetUrl, siteURL)) {
        return (
            <span
                className={className}
                title={title}
                style={style}
            >
                {label}
            </span>
        );
    }

    return (
        <ExternalLink
            className={className || 'theme markdown__link'}
            href={targetUrl}
            title={title}
            location={location}
            style={style}
        >
            {label}
        </ExternalLink>
    );
};

export default BlockedImageLink;
