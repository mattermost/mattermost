// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {dropTargetForElements} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import React, {memo, useCallback, useEffect, useRef} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {
    LinkVariantIcon,
    PaperclipIcon,
    PlusIcon,
} from '@mattermost/compass-icons/components';
import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import * as Menu from 'components/menu';

import {useBookmarkAddActions} from './channel_bookmarks_menu';
import OverflowBookmarkItem from './overflow_bookmark_item';
import {MAX_BOOKMARKS_PER_CHANNEL} from './utils';

interface BookmarksBarMenuProps {
    channelId: string;
    overflowItems: string[];
    bookmarks: IDMappedObjects<ChannelBookmark>;
    hasBookmarks: boolean;
    limitReached: boolean;
    canUploadFiles: boolean;
    canReorder: boolean;
    isDragging: boolean;
    canAdd: boolean;
    forceOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    reorderState?: {isReordering: boolean; itemId: string | null};
    getItemProps?: (id: string) => {tabIndex: number; onKeyDown: (e: React.KeyboardEvent) => void};
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
    canAdd,
    forceOpen,
    onOpenChange,
    reorderState,
    getItemProps,
}: BookmarksBarMenuProps) {
    const {formatMessage} = useIntl();
    const triggerRef = useRef<HTMLDivElement>(null);
    const {handleCreateLink, handleCreateFile} = useBookmarkAddActions(channelId);

    const hasOverflow = overflowItems.length > 0;

    // MUI's autoFocusItem can't see through OverflowBookmarkItem wrappers,
    // so we disable it and handle initial focus via DOM query.
    // ArrowDown/Up from the Paper focuses the first/last menuitem;
    // once a menuitem has focus, MUI handles cycling.
    const handleMenuKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            const focusedIsItem = (e.target as HTMLElement).getAttribute('role') === 'menuitem';
            if (focusedIsItem) {
                return;
            }
            const menu = document.getElementById('channelBookmarksBarMenuDropdown');
            const items = menu?.querySelectorAll('[role="menuitem"]');
            if (items?.length) {
                e.preventDefault();
                const target = e.key === 'ArrowDown' ? items[0] : items[items.length - 1];
                (target as HTMLElement).focus();
            }
        }
    }, []);

    // Drops are rejected via canDrop when there is no overflow so the trailing
    // add-bookmark button never auto-opens the menu during a drag.
    const hasOverflowRef = useRef(hasOverflow);
    hasOverflowRef.current = hasOverflow;
    useEffect(() => {
        const el = triggerRef.current;
        if (!el) {
            return undefined;
        }
        return dropTargetForElements({
            element: el,
            getData: () => ({type: 'overflow-trigger'}),
            canDrop: ({source}) => source.data.type === 'bookmark' && hasOverflowRef.current,
        });
    }, []);

    const handleToggle = useCallback((open: boolean) => {
        if (!open) {
            onOpenChange?.(false);
        }
    }, [onOpenChange]);

    // Don't show menu if no overflow items and user can't add or limit reached
    if (!hasOverflow && (!canAdd || limitReached)) {
        return null;
    }

    // Button content
    let buttonContent;
    let buttonClass = 'channelBookmarksBarMenuButton';

    if (hasOverflow) {
        buttonContent = (
            <>
                <PlusIcon size={16}/>
                <OverflowCount>{overflowItems.length}</OverflowCount>
            </>
        );
    } else if (hasBookmarks) {
        buttonContent = <PlusIcon size={18}/>;
    } else {
        buttonClass += ' withLabel';
        buttonContent = (
            <ButtonContent>
                <PlusIcon size={16}/>
                <span>
                    {formatMessage({id: 'channel_bookmarks.addBookmark', defaultMessage: 'Add a bookmark'})}
                </span>
            </ButtonContent>
        );
    }

    const addBookmarkLabel = formatMessage({id: 'channel_bookmarks.addBookmark', defaultMessage: 'Add a bookmark'});
    const addLinkLabel = formatMessage({id: 'channel_bookmarks.addLink', defaultMessage: 'Add a link'});
    const attachFileLabel = formatMessage({id: 'channel_bookmarks.attachFile', defaultMessage: 'Attach a file'});
    const limitReachedLabel = formatMessage({id: 'channel_bookmarks.addBookmarkLimitReached', defaultMessage: 'Cannot add more than {limit} bookmarks'}, {limit: MAX_BOOKMARKS_PER_CHANNEL});

    // Build menu items as a flat array to avoid Fragment children warning from MUI
    const menuItems: React.ReactNode[] = [];

    if (hasOverflow) {
        overflowItems.forEach((id) => {
            const bookmark = bookmarks[id];
            if (!bookmark) {
                return;
            }
            menuItems.push(
                <OverflowBookmarkItem
                    key={id}
                    id={id}
                    bookmark={bookmark}
                    canReorder={canReorder}
                    isDragging={isDragging}
                    isKeyboardReordering={reorderState?.isReordering && reorderState?.itemId === id}
                    keyboardReorderProps={canReorder && getItemProps ? getItemProps(id) : undefined}
                />,
            );
        });
        if (canAdd) {
            menuItems.push(
                <Menu.Separator
                    key='separator'
                    sx={{margin: '8px 0'}}
                />,
            );
        }
    }

    if (canAdd) {
        const addItemLabels = (text: string) => {
            if (limitReached) {
                return (
                    <>
                        <span>{text}</span>
                        <span>{limitReachedLabel}</span>
                    </>
                );
            }
            return <span>{text}</span>;
        };

        menuItems.push(
            <Menu.Item
                key='channelBookmarksAddLink'
                id='channelBookmarksAddLink'
                onClick={handleCreateLink}
                disabled={limitReached}
                leadingElement={<LinkVariantIcon size={18}/>}
                labels={addItemLabels(addLinkLabel)}
            />,
        );
        if (canUploadFiles) {
            menuItems.push(
                <Menu.Item
                    key='channelBookmarksAttachFile'
                    id='channelBookmarksAttachFile'
                    onClick={handleCreateFile}
                    disabled={limitReached}
                    leadingElement={<PaperclipIcon size={18}/>}
                    labels={addItemLabels(attachFileLabel)}
                />,
            );
        }
    }

    let overflowLabel = '';
    let buttonTooltip;
    if (hasOverflow) {
        overflowLabel = formatMessage({id: 'channel_bookmarks.overflowMenu', defaultMessage: '{count, plural, one {# more bookmark} other {# more bookmarks}}'}, {count: overflowItems.length});
        buttonTooltip = {text: overflowLabel};
    } else if (canAdd) {
        buttonTooltip = {text: addBookmarkLabel};
    }

    return (
        <MenuContainer ref={triggerRef}>
            <Menu.Container
                anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                transformOrigin={{vertical: 'top', horizontal: 'right'}}
                menuButton={{
                    id: 'channelBookmarksBarMenuButton',
                    class: buttonClass,
                    children: buttonContent,
                    'aria-label': overflowLabel || addBookmarkLabel,
                }}
                menuButtonTooltip={buttonTooltip}
                menu={{
                    id: 'channelBookmarksBarMenuDropdown',
                    isMenuOpen: forceOpen,
                    onToggle: handleToggle,
                    onKeyDown: handleMenuKeyDown,
                    hideBackdrop: isDragging || reorderState?.isReordering,
                    disableRestoreFocus: reorderState?.isReordering,
                    autoFocusItem: false,
                    width: hasOverflow ? '280px' : undefined,
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
`;

const ButtonContent = styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
`;

const OverflowCount = styled.span`
    font-variant-numeric: tabular-nums;
    min-width: 1em;
`;

