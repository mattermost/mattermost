// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useDroppable} from '@dnd-kit/core';
import {SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable';
import React, {memo, useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';

import {
    DotsHorizontalIcon,
    LinkVariantIcon,
    PaperclipIcon,
    PlusIcon,
} from '@mattermost/compass-icons/components';
import type {ChannelBookmark, ChannelBookmarkCreate} from '@mattermost/types/channel_bookmarks';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import {createBookmark} from 'actions/channel_bookmarks';
import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';

import ChannelBookmarkCreateModal from './channel_bookmarks_create_modal';
import OverflowBookmarkItem from './overflow_bookmark_item';
import {MAX_BOOKMARKS_PER_CHANNEL, useChannelBookmarkPermission} from './utils';

interface BookmarksBarMenuProps {
    channelId: string;
    overflowItems: string[];
    bookmarks: IDMappedObjects<ChannelBookmark>;
    hasBookmarks: boolean;
    limitReached: boolean;
    canUploadFiles: boolean;
    canReorder: boolean;
    isDragging: boolean;
    forceOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
}

function BookmarksBarMenu({
    channelId,
    overflowItems,
    bookmarks,
    hasBookmarks,
    limitReached,
    canUploadFiles,
    canReorder,
    isDragging,
    forceOpen,
    onOpenChange,
}: BookmarksBarMenuProps) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const canAdd = useChannelBookmarkPermission(channelId, 'add');

    const showOverflow = overflowItems.length > 0;
    const showAddSection = canAdd;
    const showMenu = showOverflow || showAddSection;

    // Menu labels
    const overflowLabel = formatMessage(
        {id: 'channel_bookmarks.menuWithOverflow', defaultMessage: '{count} more bookmarks'},
        {count: overflowItems.length},
    );
    const addBookmarkLabel = formatMessage({id: 'channel_bookmarks.addBookmark', defaultMessage: 'Add a bookmark'});
    const menuLabel = showOverflow ? overflowLabel : addBookmarkLabel;

    const addLinkLabel = formatMessage({id: 'channel_bookmarks.addLink', defaultMessage: 'Add a link'});
    const attachFileLabel = formatMessage({id: 'channel_bookmarks.attachFile', defaultMessage: 'Attach a file'});
    const limitReachedLabel = formatMessage(
        {id: 'channel_bookmarks.addBookmarkLimitReached', defaultMessage: 'Cannot add more than {limit} bookmarks'},
        {limit: MAX_BOOKMARKS_PER_CHANNEL},
    );

    // Handlers for adding bookmarks
    const handleCreate = useCallback((file?: File) => {
        dispatch(openModal({
            modalId: ModalIdentifiers.CHANNEL_BOOKMARK_CREATE,
            dialogType: ChannelBookmarkCreateModal,
            dialogProps: {
                channelId,
                bookmarkType: file ? 'file' : 'link',
                file,
                onConfirm: async (data: ChannelBookmarkCreate) => dispatch(createBookmark(channelId, data)),
            },
        }));
    }, [channelId, dispatch]);

    const handleCreateLink = useCallback(() => {
        handleCreate();
    }, [handleCreate]);

    const handleCreateFile = useCallback(() => {
        const input: HTMLInputElement = document.createElement('input');
        input.type = 'file';
        input.id = 'bookmark-create-file-input';
        input.hidden = true;

        input.addEventListener('change', () => {
            const file = input.files?.[0];
            if (file) {
                handleCreate(file);
            }
            input.remove();
        });
        input.addEventListener('cancel', input.remove);

        document.getElementById('root-portal')?.appendChild(input);
        input.click();
    }, [handleCreate]);

    // The drop zone triggers auto-open when dragging near the overflow button.
    // Once the menu is open (forceOpen), disable it so the actual overflow
    // sortable items handle collision detection instead of being shadowed.
    const {setNodeRef: setDroppableRef} = useDroppable({
        id: 'overflow-drop-zone',
        disabled: !isDragging || forceOpen === true,
    });

    const handleToggle = useCallback((open: boolean) => {
        onOpenChange?.(open);
    }, [onOpenChange]);

    if (!showMenu) {
        return null;
    }

    // Determine tooltip based on state
    const getTooltip = () => {
        if (limitReached && !showOverflow) {
            return {text: limitReachedLabel};
        }
        if (showOverflow || hasBookmarks) {
            return {text: menuLabel};
        }
        return undefined;
    };

    // Determine button content based on state
    const renderButtonContent = () => {
        if (showOverflow) {
            return (
                <ButtonContent>
                    <DotsHorizontalIcon size={16}/>
                    <OverflowCount>{overflowItems.length}</OverflowCount>
                </ButtonContent>
            );
        }
        if (!hasBookmarks) {
            return (
                <ButtonContent>
                    <PlusIcon size={16}/>
                    <span>{formatMessage({id: 'channel_bookmarks.addBookmark', defaultMessage: 'Add a bookmark'})}</span>
                </ButtonContent>
            );
        }
        return <PlusIcon size={18}/>;
    };

    const menuItems: React.ReactNode[] = [];

    if (showOverflow) {
        menuItems.push(
            <OverflowSection key='overflow-section'>
                <SortableContext
                    items={overflowItems}
                    strategy={verticalListSortingStrategy}
                    id='overflow'
                >
                    {overflowItems.map((id) => {
                        const bookmark = bookmarks[id];
                        if (!bookmark) {
                            return null;
                        }

                        return (
                            <OverflowBookmarkItem
                                key={id}
                                id={id}
                                bookmark={bookmark}
                                canReorder={canReorder}
                                isDragging={isDragging}
                            />
                        );
                    })}
                </SortableContext>
            </OverflowSection>,
        );
    }

    if (showOverflow && showAddSection) {
        menuItems.push(<Menu.Separator key='separator'/>);
    }

    if (showAddSection) {
        menuItems.push(
            <Menu.Item
                key='addLink'
                id='channelBookmarksAddLink'
                onClick={handleCreateLink}
                leadingElement={<LinkVariantIcon size={18}/>}
                labels={<span>{addLinkLabel}</span>}
                disabled={limitReached}
            />,
        );

        if (canUploadFiles) {
            menuItems.push(
                <Menu.Item
                    key='attachFile'
                    id='channelBookmarksAttachFile'
                    onClick={handleCreateFile}
                    leadingElement={<PaperclipIcon size={18}/>}
                    labels={<span>{attachFileLabel}</span>}
                    disabled={limitReached}
                />,
            );
        }
    }

    return (
        <MenuContainer
            ref={setDroppableRef}
            data-testid='bookmarks-bar-menu'
        >
            <Menu.Container
                anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                transformOrigin={{vertical: 'top', horizontal: 'right'}}
                menuButton={{
                    id: 'channelBookmarksBarMenuButton',
                    class: `channelBookmarksBarMenuButton ${showOverflow ? 'hasOverflow' : ''} ${hasBookmarks ? '' : 'withLabel'}`,
                    disabled: limitReached && !showOverflow,
                    children: renderButtonContent(),
                    'aria-label': menuLabel,
                }}
                menuButtonTooltip={getTooltip()}
                menu={{
                    id: 'channelBookmarksBarMenu',
                    width: '280px',
                    isMenuOpen: forceOpen,
                    onToggle: handleToggle,
                    hideBackdrop: isDragging,
                    disableEscapeKeyDown: isDragging,
                }}
            >
                {menuItems}
            </Menu.Container>
        </MenuContainer>
    );
}

export default memo(BookmarksBarMenu);

const MenuContainer = styled.div`
    display: flex;
    align-items: center;
    flex-shrink: 0;
    padding: 0 8px;

    .channelBookmarksBarMenuButton {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px;
        border-radius: 4px;
        border: none;
        background: transparent;
        color: rgba(var(--center-channel-color-rgb), 0.56);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 150ms ease;

        &.withLabel {
            padding: 4px 12px 4px 6px;
            border-radius: 12px;
        }

        &.hasOverflow {
            background: rgba(var(--center-channel-color-rgb), 0.08);
            color: rgba(var(--center-channel-color-rgb), 0.72);
        }

        &:hover:not(:disabled) {
            background: rgba(var(--center-channel-color-rgb), 0.12);
            color: rgba(var(--center-channel-color-rgb), 0.88);
        }

        &[aria-expanded="true"] {
            background: rgba(var(--button-bg-rgb), 0.08);
            color: rgb(var(--button-bg-rgb));
        }

        &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
    }
`;

const ButtonContent = styled.span`
    display: flex;
    align-items: center;
    gap: 4px;
`;

const OverflowCount = styled.span`
    font-variant-numeric: tabular-nums;
    min-width: 1em;
    text-align: center;
`;

const OverflowSection = styled.ul`
    display: flex;
    flex-direction: column;
    padding: 4px 0;
    margin: 0;
    list-style: none;
    max-height: 300px;
    overflow-y: auto;
`;
