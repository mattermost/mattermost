// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import {Link} from 'react-router-dom';
import styled, {css} from 'styled-components';

import {getChannelBookmark} from 'mattermost-redux/selectors/entities/channel_bookmarks';

import RenderEmoji from 'components/emoji/render_emoji';
import ExternalLink from 'components/external_link';

import {getSiteURL, shouldOpenInNewTab} from 'utils/url';

import type {GlobalState} from 'types/store';

import BookmarkItemDotMenu from './bookmark_dot_menu';

type Props = {id: string; channelId: string};
const BookmarkItem = ({
    id,
    channelId,
}: Props) => {
    const bookmark = useSelector((state: GlobalState) => getChannelBookmark(state, channelId, id));

    let icon;

    if (bookmark.emoji) {
        const emojiName = bookmark.emoji.slice(1, -1);
        icon = <Icon><RenderEmoji emojiName={emojiName}/></Icon>;
    }

    if (bookmark.type === 'link' && bookmark.link_url) {
        return (
            <Chip>
                <DynamicLink href={bookmark.link_url}>
                    {icon}
                    <Label>{bookmark.display_name}</Label>
                </DynamicLink>
                <BookmarkItemDotMenu bookmark={bookmark}/>
            </Chip>
        );
    }

    return null;
};

const Chip = styled.div`
    position: relative;
    border-radius: 12px;
    overflow: hidden;
    margin: 1px 0;
    flex-shrink: 0;
    min-width: 5rem;
    max-width: 20rem;

    button {
        position: absolute;
        visibility: hidden;
        right: 6px;
        top: 4px;
    }

    &:hover,
    &:focus-within,
    &:has([aria-expanded="true"]) {
        button {
            visibility: visible;
        }
    }

    &:hover,
    &:focus-within {
        a {
            text-decoration: none;
        }
    }

    &:hover,
    &:focus-within,
    &:has([aria-expanded="true"]) {
        a {
            background: rgba(var(--center-channel-color-rgb), 0.08);
            color: rgba(var(--center-channel-color-rgb), 1);
        }
    }

    &:active:not(:has(button:active)),
    &--active,
    &--active:hover {
        a {
            background: rgba(var(--button-bg-rgb), 0.08);
            color: rgb(var(--button-bg-rgb)) !important;

            .icon__text {
                color: rgb(var(--button-bg));
            }

            .icon {
                color: rgb(var(--button-bg));
            }
        }

    }
`;

const Label = styled.span`
    white-space: nowrap;
    padding: 4px 0;
`;

const Icon = styled.span`
    padding: 3px 1px 3px 2px;
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
                href={prefixed ? href.substring(1) : href}
                rel='noopener noreferrer'
                target='_blank'
            >
                {children}
            </StyledExternalLink>
        );
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
    display: flex;
    padding: 0 12px 0 6px;
    gap: 5px;

    color: rgba(var(--center-channel-color-rgb), 1);
    font-family: Open Sans;
    font-size: 12px;
    font-style: normal;
    font-weight: 600;
    line-height: 16px;
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
