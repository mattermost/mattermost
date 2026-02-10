// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import React, {useCallback, useContext, useRef} from 'react';
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
import {MenuContext} from 'components/menu/menu_context';

import {ModalIdentifiers} from 'utils/constants';
import {getSiteURL, shouldOpenInNewTab} from 'utils/url';

import type {GlobalState} from 'types/store';

import BookmarkItemDotMenu from './bookmark_dot_menu';
import BookmarkIcon from './bookmark_icon';

interface OverflowBookmarkItemProps {
    id: string;
    bookmark: ChannelBookmark;
    canReorder: boolean;
    isDragging: boolean;
}

function OverflowBookmarkItem({
    id,
    bookmark,
    canReorder,
    isDragging: globalIsDragging,
}: OverflowBookmarkItemProps) {
    const dispatch = useDispatch();
    const linkRef = useRef<HTMLAnchorElement>(null);
    const menuContext = useContext(MenuContext);

    const fileInfo: FileInfo | undefined = useSelector(
        (state: GlobalState) => (bookmark?.file_id && getFile(state, bookmark.file_id)) || undefined,
    );

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id,
        disabled: !canReorder,
        data: {
            bookmark,
            isInOverflow: true,
        },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    // Open the bookmark via its rendered anchor element
    const open = useCallback(() => {
        linkRef.current?.click();
    }, []);

    const handleOpenFile = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        if (globalIsDragging || isDragging) {
            return;
        }

        if (fileInfo) {
            menuContext.close?.();
            dispatch(openModal({
                modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
                dialogType: FilePreviewModal,
                dialogProps: {
                    post: {user_id: bookmark.owner_id, channel_id: bookmark.channel_id} as Post,
                    fileInfos: [fileInfo],
                    startIndex: 0,
                },
            }));
        }
    }, [dispatch, fileInfo, bookmark.owner_id, bookmark.channel_id, menuContext, globalIsDragging, isDragging]);

    const handleLinkClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
        if (globalIsDragging || isDragging) {
            e.preventDefault();
            return;
        }
        menuContext.close?.();
    }, [menuContext, globalIsDragging, isDragging]);

    // Keyboard support: Enter/Space triggers the link
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!globalIsDragging && !isDragging) {
                open();
            }
        }
    }, [open, globalIsDragging, isDragging]);

    const icon = (
        <LeadingElement>
            <BookmarkIcon
                type={bookmark.type}
                emoji={bookmark.emoji}
                imageUrl={bookmark.image_url}
                fileInfo={fileInfo}
            />
        </LeadingElement>
    );

    return (
        <ItemContainer
            ref={setNodeRef}
            role='menuitem'
            tabIndex={-1}
            style={style}
            $isDragging={isDragging}
            data-testid={`overflow-bookmark-item-${id}`}
            onKeyDown={handleKeyDown}
        >
            <DragHandle
                {...attributes}
                {...listeners}
                $canDrag={canReorder}
            >
                {icon}
                <BookmarkLink
                    bookmark={bookmark}
                    linkRef={linkRef}
                    onOpenFile={handleOpenFile}
                    onLinkClick={handleLinkClick}
                    disableLinks={globalIsDragging || isDragging}
                />
            </DragHandle>
            <TrailingElement>
                <BookmarkItemDotMenu
                    bookmark={bookmark}
                    open={open}
                    buttonClassName='channelBookmarksDotMenuButton--overflow'
                />
            </TrailingElement>
        </ItemContainer>
    );
}

// Separate component for the link to handle different link types
interface BookmarkLinkProps {
    bookmark: ChannelBookmark;
    linkRef: React.RefObject<HTMLAnchorElement>;
    onOpenFile: (e: React.MouseEvent<HTMLAnchorElement>) => void;
    onLinkClick: (e: React.MouseEvent<HTMLElement>) => void;
    disableLinks?: boolean;
}

function BookmarkLink({bookmark, linkRef, onOpenFile, onLinkClick, disableLinks}: BookmarkLinkProps) {
    const siteURL = getSiteURL();

    if (bookmark.type === 'link' && bookmark.link_url) {
        const href = bookmark.link_url;
        const openInNewTab = shouldOpenInNewTab(href, siteURL);
        const prefixed = href[0] === '!';

        if (disableLinks) {
            return (
                <StyledSpan tabIndex={-1}>
                    <Label>{bookmark.display_name}</Label>
                </StyledSpan>
            );
        }

        if (prefixed || openInNewTab) {
            return (
                <StyledExternalLink
                    href={prefixed ? href.substring(1) : href}
                    rel='noopener noreferrer'
                    target='_blank'
                    location='channel_bookmarks.overflow'
                    ref={linkRef}
                    onClick={onLinkClick}
                    tabIndex={-1}
                >
                    <Label>{bookmark.display_name}</Label>
                </StyledExternalLink>
            );
        }

        if (href.startsWith(siteURL)) {
            return (
                <StyledLink
                    to={href.slice(siteURL.length)}
                    ref={linkRef as React.RefObject<HTMLAnchorElement>}
                    onClick={onLinkClick}
                    tabIndex={-1}
                >
                    <Label>{bookmark.display_name}</Label>
                </StyledLink>
            );
        }

        return (
            <StyledAnchor
                href={href}
                ref={linkRef}
                onClick={onLinkClick}
                tabIndex={-1}
            >
                <Label>{bookmark.display_name}</Label>
            </StyledAnchor>
        );
    }

    if (bookmark.type === 'file' && bookmark.file_id) {
        if (disableLinks) {
            return (
                <StyledSpan tabIndex={-1}>
                    <Label>{bookmark.display_name}</Label>
                </StyledSpan>
            );
        }
        return (
            <StyledAnchor
                href={getFileDownloadUrl(bookmark.file_id)}
                onClick={onOpenFile}
                ref={linkRef}
                tabIndex={-1}
            >
                <Label>{bookmark.display_name}</Label>
            </StyledAnchor>
        );
    }

    return null;
}

const ItemContainer = styled.li<{$isDragging: boolean}>`
    display: flex;
    align-items: center;
    padding: 6px 20px;
    min-height: 36px;
    list-style: none;
    outline: none;

    ${({$isDragging}) => $isDragging && css`
        background: rgba(var(--center-channel-color-rgb), 0.08);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
    `}

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }

    &:focus-visible {
        box-shadow: 0 0 0 2px var(--sidebar-text-active-border) inset;
    }

    /* Show dot menu on hover, focus-within, or when its dropdown is open */
    &:hover,
    &:focus-within,
    &:has([aria-expanded="true"]) {
        > div:last-child {
            opacity: 1;
        }
    }
`;

const DragHandle = styled.div<{$canDrag: boolean}>`
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    cursor: ${({$canDrag}) => ($canDrag ? 'grab' : 'pointer')};

    &:active {
        cursor: ${({$canDrag}) => ($canDrag ? 'grabbing' : 'pointer')};
    }
`;

const LeadingElement = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const TrailingElement = styled.div`
    opacity: 0;
    transition: opacity 150ms ease;
    flex-shrink: 0;
    margin-inline-start: 4px;
`;

const linkStyles = css`
    display: flex;
    align-items: center;
    min-width: 0;
    color: var(--center-channel-color);
    font-size: 14px;
    font-weight: 400;
    line-height: 16px;
    text-decoration: none;

    &:hover,
    &:visited,
    &:active,
    &:focus {
        text-decoration: none;
        color: var(--center-channel-color);
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

const StyledSpan = styled.span`
    ${linkStyles}
`;

const Label = styled.span`
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
`;

export default OverflowBookmarkItem;
