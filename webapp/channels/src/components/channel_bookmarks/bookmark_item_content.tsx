// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnchorHTMLAttributes} from 'react';
import React, {forwardRef, useCallback, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {Link} from 'react-router-dom';
import styled, {css} from 'styled-components';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';
import type {FileInfo} from '@mattermost/types/files';
import type {Post} from '@mattermost/types/posts';

import {getFile} from 'mattermost-redux/selectors/entities/files';
import {getFileDownloadUrl} from 'mattermost-redux/utils/file_utils';

import {openModal} from 'actions/views/modals';

import ExternalLink from 'components/external_link';
import FilePreviewModal from 'components/file_preview_modal';

import {ModalIdentifiers} from 'utils/constants';
import {getSiteURL, shouldOpenInNewTab} from 'utils/url';

import type {GlobalState} from 'types/store';

import BookmarkItemDotMenu from './bookmark_dot_menu';
import BookmarkIcon from './bookmark_icon';

/**
 * Hook that provides link data and handlers for a bookmark.
 * Shared by both bar items (BookmarkItemContent) and overflow items.
 *
 * @param bookmark - The bookmark to render
 * @param disableLinks - When true, href is undefined (e.g. during drag)
 * @param onNavigate - Optional callback fired after link click or file preview open
 */
export const useBookmarkLink = (
    bookmark: ChannelBookmark,
    disableLinks: boolean,
    onNavigate?: () => void,
) => {
    const linkRef = useRef<HTMLAnchorElement>(null);
    const dispatch = useDispatch();
    const fileInfo: FileInfo | undefined = useSelector((state: GlobalState) => (bookmark?.file_id && getFile(state, bookmark.file_id)) || undefined);

    const open = useCallback(() => {
        linkRef.current?.click();
    }, []);

    const handleOpenFile = useCallback((e: React.MouseEvent<HTMLElement>) => {
        e.preventDefault();

        if (fileInfo) {
            dispatch(openModal({
                modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
                dialogType: FilePreviewModal,
                dialogProps: {
                    post: {user_id: bookmark.owner_id, channel_id: bookmark.channel_id} as Post,
                    fileInfos: [fileInfo],
                    startIndex: 0,
                },
            }));
            onNavigate?.();
        }
    }, [dispatch, fileInfo, bookmark.owner_id, bookmark.channel_id, onNavigate]);

    const handleLinkClick = useCallback(() => {
        onNavigate?.();
    }, [onNavigate]);

    const icon = (
        <BookmarkIcon
            type={bookmark.type}
            emoji={bookmark.emoji}
            imageUrl={bookmark.image_url}
            fileInfo={fileInfo}
        />
    );

    let href: string | undefined;
    let onClick: ((e: React.MouseEvent<HTMLElement>) => void) | undefined;
    let isFile = false;

    if (bookmark.type === 'link' && bookmark.link_url) {
        href = disableLinks ? undefined : bookmark.link_url;
        onClick = onNavigate ? handleLinkClick : undefined;
    } else if (bookmark.type === 'file' && bookmark.file_id) {
        href = disableLinks ? undefined : getFileDownloadUrl(bookmark.file_id);
        onClick = handleOpenFile;
        isFile = true;
    }

    return {
        href,
        onClick,
        linkRef,
        isFile,
        icon,
        displayName: bookmark.display_name,
        open,
    } as const;
};

interface BookmarkItemContentProps {
    bookmark: ChannelBookmark;
    disableInteractions: boolean;
    onMoveBefore?: () => void;
    onMoveAfter?: () => void;
    moveBeforeLabel?: string;
    moveAfterLabel?: string;
    moveDirection?: 'horizontal' | 'vertical';
}

const BookmarkItemContent = ({bookmark, disableInteractions, onMoveBefore, onMoveAfter, moveBeforeLabel, moveAfterLabel, moveDirection}: BookmarkItemContentProps) => {
    const {href, onClick, linkRef, isFile, icon, displayName, open} = useBookmarkLink(bookmark, disableInteractions);
    const hasLink = bookmark.type === 'link' || bookmark.type === 'file';

    return (
        <Chip $disableInteractions={disableInteractions}>
            {hasLink && (
                <DynamicLink
                    href={href}
                    onClick={onClick}
                    ref={linkRef}
                    isFile={isFile}
                    draggable={false}
                    role='link'
                >
                    {icon}
                    <Label>{displayName}</Label>
                </DynamicLink>
            )}
            <BookmarkItemDotMenu
                bookmark={bookmark}
                open={open}
                onMoveBefore={onMoveBefore}
                onMoveAfter={onMoveAfter}
                moveBeforeLabel={moveBeforeLabel}
                moveAfterLabel={moveAfterLabel}
                moveDirection={moveDirection}
            />
        </Chip>
    );
};

const Chip = styled.div<{$disableInteractions: boolean}>`
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    min-width: 0;
    overflow: hidden;

    /* Bar link styles — applied to any anchor/span rendered by DynamicLink */
    a, span[role="link"] {
        display: flex;
        padding: 0 12px 0 6px;
        gap: 5px;
        min-width: 0;
        overflow: hidden;
        color: rgba(var(--center-channel-color-rgb), 1);
        font-family: Open Sans;
        font-size: 12px;
        font-style: normal;
        font-weight: 600;
        line-height: 16px;
    }

    button {
        position: absolute;
        visibility: hidden;
        right: 6px;
        top: 3px;
    }

    ${({$disableInteractions}) => !$disableInteractions && css`
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
                cursor: pointer;
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
    `}
`;

const Label = styled.span`
    white-space: nowrap;
    padding: 4px 0;
    text-overflow: ellipsis;
    overflow: hidden;
`;

const TARGET_BLANK_URL_PREFIX = '!';

type DynamicLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'onClick'> & {
    href?: string;
    children: React.ReactNode;
    isFile: boolean;
    onClick?: (e: React.MouseEvent<HTMLElement>) => void;
};

/**
 * Smart link component that chooses the best rendering strategy based on href.
 * Renders plain elements — callers apply styling via parent CSS selectors.
 */
export const DynamicLink = forwardRef<HTMLAnchorElement, DynamicLinkProps>(({
    href,
    children,
    isFile,
    ...otherProps
}, ref) => {
    if (!href) {
        return (
            <span
                {...otherProps}
                ref={ref as React.Ref<HTMLSpanElement>}
                draggable={false}
            >
                {children}
            </span>
        );
    }

    const siteURL = getSiteURL();
    const openInNewTab = shouldOpenInNewTab(href, siteURL);

    const prefixed = href[0] === TARGET_BLANK_URL_PREFIX;

    if (prefixed || openInNewTab) {
        return (
            <ExternalLink
                {...otherProps}
                href={prefixed ? href.substring(1) : href}
                rel='noopener noreferrer'
                target='_blank'
                location='channel_bookmarks.item'
                ref={ref}
                draggable={false}
            >
                {children}
            </ExternalLink>
        );
    }

    if (href.startsWith(siteURL) && !isFile) {
        return (
            <Link
                {...otherProps}
                to={href.slice(siteURL.length)}
                ref={ref}
                draggable={false}
            >
                {children}
            </Link>
        );
    }

    return (
        <a
            {...otherProps}
            href={href}
            ref={ref}
            draggable={false}
        >
            {children}
        </a>
    );
});
DynamicLink.displayName = 'DynamicLink';

export default BookmarkItemContent;
