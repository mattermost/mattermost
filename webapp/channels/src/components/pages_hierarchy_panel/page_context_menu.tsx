// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useCallback} from 'react';
import {useDispatch} from 'react-redux';

import {togglePageOutline} from 'actions/views/pages_hierarchy';

import {getSiteURL} from 'utils/url';
import {copyToClipboard} from 'utils/utils';

import './page_context_menu.scss';

type MenuOption = {
    id: string;
    label: string;
    icon: string;
    action: () => void;
    dangerous?: boolean;
    separator?: boolean;
};

type Props = {
    pageId: string;
    wikiId?: string;
    position: {x: number; y: number};
    onClose: () => void;
    onCreateChild?: () => void;
    onRename?: () => void;
    onDuplicate?: () => void;
    onMove?: () => void;
    onDelete?: () => void;
    onVersionHistory?: () => void;
    isDraft?: boolean;
    pageLink?: string;
    isOutlineVisible?: boolean;
};

const PageContextMenu = ({
    pageId,
    wikiId,
    position,
    onClose,
    onCreateChild,
    onRename,
    onDuplicate,
    onMove,
    onDelete,
    onVersionHistory,
    isDraft = false,
    pageLink,
    isOutlineVisible = false,
}: Props) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const dispatch = useDispatch();

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    const handleShowOutline = useCallback(() => {
        dispatch(togglePageOutline(pageId, undefined, wikiId));
        onClose();
    }, [dispatch, pageId, wikiId, onClose]);

    const handleCopyLink = useCallback(() => {
        if (pageLink && pageLink !== '#') {
            const siteURL = getSiteURL();
            const fullUrl = `${siteURL}${pageLink}`;
            copyToClipboard(fullUrl);
        }
        onClose();
    }, [pageLink, onClose]);

    const handleOpenInNewWindow = useCallback(() => {
        if (pageLink && pageLink !== '#') {
            const siteURL = getSiteURL();
            const fullUrl = `${siteURL}${pageLink}`;
            window.open(fullUrl, '_blank', 'noopener,noreferrer');
        }
        onClose();
    }, [pageLink, onClose]);

    const menuOptions: MenuOption[] = [
        {
            id: 'new-child',
            label: 'New subpage',
            icon: 'icon-plus',
            action: () => {
                onCreateChild?.();
                onClose();
            },
        },
        {separator: true, id: 'sep1', label: '', icon: '', action: () => {}},
        {
            id: 'show-outline',
            label: isOutlineVisible ? 'Hide outline' : 'Show outline',
            icon: 'icon-format-list-bulleted',
            action: handleShowOutline,
        },
        {
            id: 'rename',
            label: 'Rename',
            icon: 'icon-pencil-outline',
            action: () => {
                onRename?.();
                onClose();
            },
        },
        {
            id: 'copy-link',
            label: 'Copy link',
            icon: 'icon-link-variant',
            action: handleCopyLink,
        },
        {
            id: 'move',
            label: 'Move to...',
            icon: 'icon-folder-move',
            action: () => {
                onMove?.();
                onClose();
            },
        },
        {
            id: 'duplicate',
            label: 'Duplicate page',
            icon: 'icon-content-copy',
            action: () => {
                onDuplicate?.();
                onClose();
            },
        },
        {separator: true, id: 'sep2', label: '', icon: '', action: () => {}},
        {
            id: 'version-history',
            label: 'Version History',
            icon: 'icon-history',
            action: () => {
                onVersionHistory?.();
                onClose();
            },
        },
        {
            id: 'delete',
            label: isDraft ? 'Delete draft' : 'Delete page',
            icon: 'icon-trash-can-outline',
            action: () => {
                onDelete?.();
                onClose();
            },
            dangerous: true,
        },
        {separator: true, id: 'sep3', label: '', icon: '', action: () => {}},
        {
            id: 'open-new-window',
            label: 'Open in new window',
            icon: 'icon-open-in-new',
            action: handleOpenInNewWindow,
        },
    ];

    return (
        <div
            ref={menuRef}
            className='PageContextMenu'
            style={{
                top: `${position.y}px`,
                left: `${position.x}px`,
            }}
            onClick={(e) => e.stopPropagation()}
            data-testid='page-context-menu'
        >
            {menuOptions.map((option) => {
                if (option.separator) {
                    return (
                        <div
                            key={option.id}
                            className='PageContextMenu__separator'
                        />
                    );
                }

                return (
                    <button
                        key={option.id}
                        className={`PageContextMenu__item ${option.dangerous ? 'PageContextMenu__item--dangerous' : ''}`}
                        onClick={option.action}
                        data-testid={`page-context-menu-${option.id}`}
                    >
                        <i className={option.icon}/>
                        <span>{option.label}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default PageContextMenu;
