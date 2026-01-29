// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import React, {useCallback, useContext, useEffect, useRef} from 'react';
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

    // Track pointer sessions to detect if a click originated from a drag
    const pointerSessionRef = useRef<{isDragSession: boolean} | null>(null);

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

    // Mark current pointer session as a drag session when dragging starts
    useEffect(() => {
        if ((isDragging || globalIsDragging) && pointerSessionRef.current) {
            pointerSessionRef.current.isDragSession = true;
        }
    }, [isDragging, globalIsDragging]);

    // Track pointer down to start a new session
    const handlePointerDown = useCallback(() => {
        pointerSessionRef.current = {isDragSession: false};
    }, []);

    // Clear session after click event has fired
    const handlePointerUp = useCallback(() => {
        // Use requestAnimationFrame to ensure click event fires first
        requestAnimationFrame(() => {
            pointerSessionRef.current = null;
        });
    }, []);

    // Check if we should prevent click (drag occurred in this pointer session)
    const shouldPreventClick = useCallback(() => {
        return globalIsDragging || isDragging || pointerSessionRef.current?.isDragSession;
    }, [globalIsDragging, isDragging]);

    const open = useCallback(() => {
        linkRef.current?.click();
    }, []);

    const handleOpenFile = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();

        // Prevent click if this pointer session was a drag
        if (shouldPreventClick()) {
            return;
        }

        if (fileInfo) {
            // Close the menu before opening file preview
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
    }, [dispatch, fileInfo, bookmark.owner_id, bookmark.channel_id, menuContext, shouldPreventClick]);

    const handleLinkClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
        // Prevent click if this pointer session was a drag
        if (shouldPreventClick()) {
            e.preventDefault();
            return;
        }

        // Close the menu when clicking a link
        menuContext.close?.();
    }, [menuContext, shouldPreventClick]);

    const handleClick = useCallback((e: React.MouseEvent) => {
        // Prevent click if this pointer session was a drag
        if (shouldPreventClick()) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, [shouldPreventClick]);

    const icon = (
        <BookmarkIcon
            type={bookmark.type}
            emoji={bookmark.emoji}
            imageUrl={bookmark.image_url}
            fileInfo={fileInfo}
        />
    );

    return (
        <ItemContainer
            ref={setNodeRef}
            style={style}
            $isDragging={isDragging}
            data-testid={`overflow-bookmark-item-${id}`}
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
        >
            <DragHandle
                {...attributes}
                {...listeners}
                $canDrag={canReorder}
            >
                <ItemContent>
                    <BookmarkLink
                        bookmark={bookmark}
                        linkRef={linkRef}
                        onOpenFile={handleOpenFile}
                        onLinkClick={handleLinkClick}
                        icon={icon}
                    />
                </ItemContent>
            </DragHandle>
            <DotMenuWrapper>
                <BookmarkItemDotMenu
                    bookmark={bookmark}
                    open={open}
                />
            </DotMenuWrapper>
        </ItemContainer>
    );
}

// Separate component for the link to handle different link types
interface BookmarkLinkProps {
    bookmark: ChannelBookmark;
    linkRef: React.RefObject<HTMLAnchorElement>;
    onOpenFile: (e: React.MouseEvent<HTMLAnchorElement>) => void;
    onLinkClick: (e: React.MouseEvent<HTMLElement>) => void;
    icon: React.ReactNode;
}

function BookmarkLink({bookmark, linkRef, onOpenFile, onLinkClick, icon}: BookmarkLinkProps) {
    const siteURL = getSiteURL();

    if (bookmark.type === 'link' && bookmark.link_url) {
        const href = bookmark.link_url;
        const openInNewTab = shouldOpenInNewTab(href, siteURL);
        const prefixed = href[0] === '!';

        if (prefixed || openInNewTab) {
            return (
                <StyledExternalLink
                    href={prefixed ? href.substring(1) : href}
                    rel='noopener noreferrer'
                    target='_blank'
                    location='channel_bookmarks.overflow'
                    ref={linkRef}
                    onClick={onLinkClick}
                >
                    {icon}
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
                >
                    {icon}
                    <Label>{bookmark.display_name}</Label>
                </StyledLink>
            );
        }

        return (
            <StyledAnchor
                href={href}
                ref={linkRef}
                onClick={onLinkClick}
            >
                {icon}
                <Label>{bookmark.display_name}</Label>
            </StyledAnchor>
        );
    }

    if (bookmark.type === 'file' && bookmark.file_id) {
        return (
            <StyledAnchor
                href={getFileDownloadUrl(bookmark.file_id)}
                onClick={onOpenFile}
                ref={linkRef}
            >
                {icon}
                <Label>{bookmark.display_name}</Label>
            </StyledAnchor>
        );
    }

    return null;
}

const ItemContainer = styled.div<{$isDragging: boolean}>`
    display: flex;
    align-items: center;
    padding: 0 8px;
    margin: 0 4px;
    border-radius: 4px;
    min-height: 32px;
    position: relative;

    ${({$isDragging}) => $isDragging && css`
        background: rgba(var(--center-channel-color-rgb), 0.08);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
    `}

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }

    /* Show dot menu on hover */
    &:hover,
    &:focus-within {
        > div:last-child {
            opacity: 1;
        }
    }
`;

const DragHandle = styled.div<{$canDrag: boolean}>`
    flex: 1;
    min-width: 0;
    cursor: ${({$canDrag}) => ($canDrag ? 'grab' : 'pointer')};

    &:active {
        cursor: ${({$canDrag}) => ($canDrag ? 'grabbing' : 'pointer')};
    }
`;

const ItemContent = styled.div`
    display: flex;
    align-items: center;
    min-width: 0;
`;

const DotMenuWrapper = styled.div`
    opacity: 0;
    transition: opacity 150ms ease;
    flex-shrink: 0;

    /* Override default positioning from bookmark_dot_menu */
    button {
        position: relative !important;
        visibility: visible !important;
        right: auto !important;
        top: auto !important;
    }
`;

const linkStyles = css`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    color: rgba(var(--center-channel-color-rgb), 1);
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    text-decoration: none;
    min-width: 0;

    &:hover,
    &:visited,
    &:active,
    &:focus {
        text-decoration: none;
        color: rgba(var(--center-channel-color-rgb), 1);
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

const Label = styled.span`
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
`;

export default OverflowBookmarkItem;
