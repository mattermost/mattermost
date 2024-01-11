// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import {Link} from 'react-router-dom';
import styled, {css} from 'styled-components';

import ExternalLink from 'components/external_link';

import {getSiteURL, shouldOpenInNewTab} from 'utils/url';

import type {GlobalState} from 'types/store';

import {getChannelBookmark} from './utils';

type Props = {id: string; channelId: string};
const BookmarkItem = ({
    id,
    channelId,
}: Props) => {
    const bookmark = useSelector((state: GlobalState) => getChannelBookmark(state, channelId, id));

    if (bookmark.type === 'link' && bookmark.link_url) {
        return (
            <DynamicLink href={bookmark.link_url}>
                <Chip>
                    {bookmark.display_name}
                </Chip>
            </DynamicLink>
        );
    }

    return null;
};

const Chip = styled.div`
    display: flex;
    padding: 4px 6px;
    gap: 5px;
    border-radius: 12px;

    &:hover,
    &:focus {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const TARGET_BLANK_URL_PREFIX = '!';

type DynamicLinkProps = {href: string; children: React.ReactNode};
const DynamicLink = ({href, children}: DynamicLinkProps) => {
    const siteURL = getSiteURL();
    const openInNewTab = shouldOpenInNewTab(href, siteURL);

    const prefixed = href[0] === TARGET_BLANK_URL_PREFIX;

    if (prefixed || openInNewTab) {
        return (
            <StyledExternalLink
                href={prefixed ? href.substring(1, href.length) : href}
                rel='noopener noreferrer'
                target='_blank'
            >
                {children}
            </StyledExternalLink>);
    }

    if (href.startsWith(siteURL)) {
        return (
            <StyledLink to={href.slice(siteURL.length)}>
                {children}
            </StyledLink>
        );
    }

    return (
        <StyledAnchor href={href}>
            {children}
        </StyledAnchor>
    );
};

const linkStyles = css`
    color: rgba(var(--center-channel-color-rgb), 1);
    font-family: Open Sans;
    font-size: 12px;
    font-style: normal;
    font-weight: 600;
    line-height: 16px;

    &:hover,
    &:focus {
        text-decoration: none;
    }
`;

const StyledAnchor = styled.a`
    &&&& {
        ${linkStyles}
    }
`;

const StyledLink = styled(Link)`
    &&&& {
        ${linkStyles}
    }
`;

const StyledExternalLink = styled(ExternalLink)`
    &&&& {
        ${linkStyles}
    }
`;

export default BookmarkItem;
