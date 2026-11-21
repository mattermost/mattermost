// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {CSSProperties} from 'react';
import {useSelector} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import ExternalLink from 'components/external_link';

import {isUrlSafe, unwrapImageProxyURL} from 'utils/url';

const blockedImageLinkStyle: CSSProperties = {
    display: 'block',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
};

type Props = {
    src: string;
    location: string;
    alt?: string;
    title?: string;
    inline?: boolean;
    disableLink?: boolean;
};

export default function BlockedImageLink({
    src,
    location,
    alt,
    title,
    inline = false,
    disableLink = false,
}: Props) {
    const siteURL = useSelector(getConfig).SiteURL || '';
    const displaySrc = unwrapImageProxyURL(src, siteURL);
    const label = alt || displaySrc;
    const linkTitle = inline ? title : (title ?? displaySrc);
    const linkStyle = inline ? undefined : blockedImageLinkStyle;

    if (disableLink || !isUrlSafe(displaySrc)) {
        return inline ? (
            <>{label}</>
        ) : (
            <span
                title={linkTitle}
                style={linkStyle}
            >
                {label}
            </span>
        );
    }

    return (
        <ExternalLink
            className='theme markdown__link'
            href={displaySrc}
            title={linkTitle}
            location={location}
            style={linkStyle}
        >
            {label}
        </ExternalLink>
    );
}
