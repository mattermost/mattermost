// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {dropTargetForElements} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import React, {memo, useCallback, useEffect, useRef} from 'react';
import {useIntl} from 'react-intl';
import styled, {css} from 'styled-components';

import {
    DotsHorizontalIcon,
    LinkVariantIcon,
    PaperclipIcon,
    PlusIcon,
} from '@mattermost/compass-icons/components';
import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import * as Menu from 'components/menu';

import {useBookmarkAddActions} from './channel_bookmarks_menu';
import OverflowBookmarkItem from './overflow_bookmark_item';

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
    order: string[];
    onKeyboardMove?: (id: string, direction: -1 | 1) => void;
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
    order,
    onKeyboardMove,
}: BookmarksBarMenuProps) {
    const {formatMessage} = useIntl();
    const triggerRef = useRef<HTMLDivElement>(null);
    const {handleCreateLink, handleCreateFile} = useBookmarkAddActions(channelId);

    const hasOverflow = overflowItems.length > 0;

    // Register as drop target for overflow auto-open trigger
    useEffect(() => {
        const el = triggerRef.current;
        if (!el) {
            return undefined;
        }
        return dropTargetForElements({
            element: el,
            getData: () => ({type: 'overflow-trigger'}),
            canDrop: ({source}) => source.data.type === 'bookmark',
        });
    }, []);

    const handleToggle = useCallback((open: boolean) => {
        onOpenChange?.(open);
    }, [onOpenChange]);

    // Don't show menu if no overflow items and user can't add
    if (!hasOverflow && !canAdd) {
        return null;
    }

    // Button content
    let buttonContent;
    let buttonClass = 'channelBookmarksBarMenuButton';

    if (hasOverflow) {
        buttonClass += ' hasOverflow';
        buttonContent = (
            <ButtonContent>
                <DotsHorizontalIcon size={18}/>
                <OverflowCount>{overflowItems.length}</OverflowCount>
            </ButtonContent>
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

    // Build menu items as a flat array to avoid Fragment children warning from MUI
    const menuItems: React.ReactNode[] = [];

    if (hasOverflow) {
        menuItems.push(
            <OverflowSection key='overflow-section'>
                {overflowItems.map((id) => {
                    const orderIndex = order.indexOf(id);
                    return (
                        <OverflowBookmarkItem
                            key={id}
                            id={id}
                            bookmark={bookmarks[id]}
                            canReorder={canReorder}
                            isDragging={isDragging}
                            onMoveUp={onKeyboardMove && orderIndex > 0 ? () => onKeyboardMove(id, -1) : undefined}
                            onMoveDown={onKeyboardMove && orderIndex < order.length - 1 ? () => onKeyboardMove(id, 1) : undefined}
                        />
                    );
                })}
            </OverflowSection>,
        );
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
        menuItems.push(
            <Menu.Item
                key='channelBookmarksAddLink'
                id='channelBookmarksAddLink'
                onClick={handleCreateLink}
                leadingElement={<LinkVariantIcon size={18}/>}
                labels={<span>{addLinkLabel}</span>}
            />,
        );
        if (canUploadFiles) {
            menuItems.push(
                <Menu.Item
                    key='channelBookmarksAttachFile'
                    id='channelBookmarksAttachFile'
                    onClick={handleCreateFile}
                    leadingElement={<PaperclipIcon size={18}/>}
                    labels={<span>{attachFileLabel}</span>}
                />,
            );
        }
    }

    return (
        <MenuContainer
            ref={triggerRef}
            $hasOverflow={hasOverflow}
        >
            <Menu.Container
                anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                transformOrigin={{vertical: 'top', horizontal: 'right'}}
                menuButton={{
                    id: 'channelBookmarksBarMenuButton',
                    class: buttonClass,
                    children: buttonContent,
                    'aria-label': hasOverflow ? formatMessage({id: 'channel_bookmarks.overflowMenu', defaultMessage: 'Show {count} more bookmarks'}, {count: overflowItems.length}) : addBookmarkLabel,
                    disabled: !hasOverflow && limitReached,
                }}
                menu={{
                    id: 'channelBookmarksBarMenuDropdown',
                    isMenuOpen: forceOpen,
                    onToggle: handleToggle,
                    hideBackdrop: forceOpen,
                    width: '280px',
                }}
            >
                {menuItems}
            </Menu.Container>
        </MenuContainer>
    );
}

export default memo(BookmarksBarMenu);

const MenuContainer = styled.div<{$hasOverflow: boolean}>`
    display: flex;
    align-items: center;
    flex-shrink: 0;
    padding: 0 8px;

    ${({$hasOverflow}) => $hasOverflow && css`
        background: linear-gradient(to right, transparent, var(--center-channel-bg) 16px);
        padding-left: 16px;
    `}
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

const OverflowSection = styled.ul`
    display: flex;
    flex-direction: column;
    padding: 0;
    max-height: 300px;
    overflow-y: auto;
    list-style: none;
    margin: 0;
`;
