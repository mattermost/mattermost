// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combine} from '@atlaskit/pragmatic-drag-and-drop/combine';
import {draggable, dropTargetForElements} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import {setCustomNativeDragPreview} from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import type {Edge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {attachClosestEdge, extractClosestEdge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {DropIndicator} from '@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box';
import React, {useCallback, useContext, useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
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
import {createBookmarkDragPreview} from './drag_preview';

interface OverflowBookmarkItemProps {
    id: string;
    bookmark: ChannelBookmark;
    canReorder: boolean;
    isDragging: boolean;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
}

const TARGET_BLANK_URL_PREFIX = '!';

const BookmarkLink: React.FC<{
    bookmark: ChannelBookmark;
    disabled: boolean;
    linkRef: React.RefObject<HTMLAnchorElement>;
}> = ({bookmark, disabled, linkRef}) => {
    const dispatch = useDispatch();
    const menuContext = useContext(MenuContext);
    const fileInfo: FileInfo | undefined = useSelector((state: GlobalState) => (bookmark?.file_id && getFile(state, bookmark.file_id)) || undefined);

    const icon = (
        <LeadingElement>
            <BookmarkIcon
                type={bookmark.type}
                emoji={bookmark.emoji}
                imageUrl={bookmark.image_url}
                fileInfo={fileInfo}
                size={16}
            />
        </LeadingElement>
    );

    const handleClick = useCallback(() => {
        if (!disabled && menuContext.close) {
            menuContext.close();
        }
    }, [disabled, menuContext]);

    const handleOpenFile = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();

        if (!disabled && fileInfo) {
            dispatch(openModal({
                modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
                dialogType: FilePreviewModal,
                dialogProps: {
                    post: {user_id: bookmark.owner_id, channel_id: bookmark.channel_id} as Post,
                    fileInfos: [fileInfo],
                    startIndex: 0,
                },
            }));
            if (menuContext.close) {
                menuContext.close();
            }
        }
    }, [disabled, fileInfo, bookmark, dispatch, menuContext]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (disabled) {
            e.preventDefault();
            return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            linkRef.current?.click();
        }
    }, [disabled, linkRef]);

    if (disabled) {
        return (
            <StyledSpan
                tabIndex={0}
                onKeyDown={handleKeyDown}
            >
                {icon}
                <Label>{bookmark.display_name}</Label>
            </StyledSpan>
        );
    }

    if (bookmark.type === 'link' && bookmark.link_url) {
        const siteURL = getSiteURL();
        const openInNewTab = shouldOpenInNewTab(bookmark.link_url, siteURL);
        const prefixed = bookmark.link_url[0] === TARGET_BLANK_URL_PREFIX;

        if (prefixed || openInNewTab) {
            return (
                <StyledExternalLink
                    href={prefixed ? bookmark.link_url.substring(1) : bookmark.link_url}
                    rel='noopener noreferrer'
                    target='_blank'
                    location='channel_bookmarks.overflow'
                    ref={linkRef}
                    onClick={handleClick}
                    onKeyDown={handleKeyDown}
                >
                    {icon}
                    <Label>{bookmark.display_name}</Label>
                </StyledExternalLink>
            );
        }

        if (bookmark.link_url.startsWith(siteURL)) {
            return (
                <StyledLink
                    to={bookmark.link_url.slice(siteURL.length)}
                    ref={linkRef}
                    onClick={handleClick}
                    onKeyDown={handleKeyDown}
                >
                    {icon}
                    <Label>{bookmark.display_name}</Label>
                </StyledLink>
            );
        }

        return (
            <StyledAnchor
                href={bookmark.link_url}
                ref={linkRef}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
            >
                {icon}
                <Label>{bookmark.display_name}</Label>
            </StyledAnchor>
        );
    } else if (bookmark.type === 'file' && bookmark.file_id) {
        return (
            <StyledAnchor
                href={getFileDownloadUrl(bookmark.file_id)}
                onClick={handleOpenFile}
                ref={linkRef}
                onKeyDown={handleKeyDown}
            >
                {icon}
                <Label>{bookmark.display_name}</Label>
            </StyledAnchor>
        );
    }

    return null;
};

function OverflowBookmarkItem({id, bookmark, canReorder, isDragging, onMoveUp, onMoveDown}: OverflowBookmarkItemProps) {
    const {formatMessage} = useIntl();
    const moveUpLabel = formatMessage({id: 'channel_bookmarks.moveUp', defaultMessage: 'Move up'});
    const moveDownLabel = formatMessage({id: 'channel_bookmarks.moveDown', defaultMessage: 'Move down'});

    const ref = useRef<HTMLLIElement>(null);
    const linkRef = useRef<HTMLAnchorElement>(null);
    const [isDragSelf, setIsDragSelf] = useState(false);
    const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

    const open = useCallback(() => {
        linkRef.current?.click();
    }, []);

    useEffect(() => {
        const el = ref.current;
        if (!el || !canReorder) {
            return undefined;
        }

        return combine(
            draggable({
                element: el,
                getInitialData: () => ({type: 'bookmark', bookmarkId: id, container: 'overflow'}),
                onGenerateDragPreview: ({nativeSetDragImage}) => {
                    setCustomNativeDragPreview({
                        nativeSetDragImage,
                        render: ({container}) => {
                            container.appendChild(createBookmarkDragPreview(bookmark.display_name));
                        },
                    });
                },
                onDragStart: () => setIsDragSelf(true),
                onDrop: () => setIsDragSelf(false),
            }),
            dropTargetForElements({
                element: el,
                getData: ({input, element}) =>
                    attachClosestEdge(
                        {type: 'bookmark', bookmarkId: id, container: 'overflow'},
                        {input, element, allowedEdges: ['top', 'bottom']},
                    ),
                canDrop: ({source}) =>
                    source.data.type === 'bookmark' && source.data.bookmarkId !== id,
                onDrag: ({self}) => setClosestEdge(extractClosestEdge(self.data)),
                onDragLeave: () => setClosestEdge(null),
                onDrop: () => setClosestEdge(null),
            }),
        );
    }, [id, canReorder]);

    const linksDisabled = isDragging || isDragSelf;

    return (
        <ItemContainer
            ref={ref}
            $isDragSelf={isDragSelf}
            data-testid={`overflow-bookmark-item-${id}`}
        >
            <DragHandle $canReorder={canReorder}>
                <BookmarkLink
                    bookmark={bookmark}
                    disabled={linksDisabled}
                    linkRef={linkRef}
                />
            </DragHandle>
            <TrailingElement>
                <BookmarkItemDotMenu
                    bookmark={bookmark}
                    open={open}
                    buttonClassName='channelBookmarksDotMenuButton--overflow'
                    onMoveBefore={onMoveUp}
                    onMoveAfter={onMoveDown}
                    moveBeforeLabel={moveUpLabel}
                    moveAfterLabel={moveDownLabel}
                    moveDirection='vertical'
                />
            </TrailingElement>
            {closestEdge && <DropIndicator edge={closestEdge}/>}
        </ItemContainer>
    );
}

export default OverflowBookmarkItem;

const ItemContainer = styled.li<{$isDragSelf: boolean}>`
    position: relative;
    display: flex;
    align-items: center;
    padding: 0 20px;
    min-height: 36px;

    /* Prevent native link/image drag so pragmatic-dnd handles it */
    a, img {
        -webkit-user-drag: none;
    }

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }

    ${({$isDragSelf}) => $isDragSelf && css`
        opacity: 0.4;
    `}
`;

const DragHandle = styled.div<{$canReorder: boolean}>`
    display: flex;
    flex: 1;
    align-items: center;
    min-width: 0;
    overflow: hidden;

    ${({$canReorder}) => $canReorder && css`
        cursor: grab;

        &:active {
            cursor: grabbing;
        }
    `}
`;

const LeadingElement = styled.div`
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
`;

const TrailingElement = styled.div`
    margin-left: 8px;
    flex-shrink: 0;
    opacity: 0;

    ${ItemContainer}:hover &,
    ${ItemContainer}:focus-within &,
    ${ItemContainer}:has([aria-expanded="true"]) & {
        opacity: 1;
    }
`;

const Label = styled.span`
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    flex: 1;
`;

const linkStyles = css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    padding: 6px 0;

    color: var(--center-channel-color);
    font-family: Open Sans;
    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    line-height: 20px;
    text-decoration: none;

    &:hover {
        text-decoration: none;
    }

    &:focus {
        outline: none;
    }

    &:focus-visible {
        text-decoration: underline;
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
    cursor: default;
`;
