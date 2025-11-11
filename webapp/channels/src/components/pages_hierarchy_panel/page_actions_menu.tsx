// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react';
import {useSelector} from 'react-redux';

import type {GlobalState} from 'types/store';

import PageContextMenu from './page_context_menu';

type Props = {
    pageId: string;
    wikiId?: string;
    onCreateChild?: () => void;
    onRename?: () => void;
    onDuplicate?: () => void;
    onMove?: () => void;
    onDelete?: () => void;
    onVersionHistory?: () => void;
    isDraft?: boolean;
    pageLink?: string;
    buttonClassName?: string;
    buttonLabel?: string;
    buttonTestId?: string;
};

const PageActionsMenu = ({
    pageId,
    wikiId,
    onCreateChild,
    onRename,
    onDuplicate,
    onMove,
    onDelete,
    onVersionHistory,
    isDraft = false,
    pageLink,
    buttonClassName = 'PagePane__icon-button btn btn-icon btn-sm',
    buttonLabel = 'More actions',
    buttonTestId = 'page-actions-menu-button',
}: Props) => {
    const [showMenu, setShowMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState({x: 0, y: 0});

    const isOutlineVisible = useSelector((state: GlobalState) =>
        state.views.pagesHierarchy.outlineExpandedNodes[pageId] || false
    );

    const handleMenuButtonClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setMenuPosition({x: rect.right, y: rect.bottom});
        setShowMenu(true);
    }, []);

    return (
        <>
            <button
                className={buttonClassName}
                aria-label={buttonLabel}
                title={buttonLabel}
                onClick={handleMenuButtonClick}
                data-testid={buttonTestId}
            >
                <i className='icon icon-dots-horizontal'/>
            </button>
            {showMenu && (
                <PageContextMenu
                    pageId={pageId}
                    wikiId={wikiId}
                    alignRight={true}
                    position={menuPosition}
                    onClose={() => setShowMenu(false)}
                    onCreateChild={onCreateChild}
                    onRename={onRename}
                    onDuplicate={onDuplicate}
                    onMove={onMove}
                    onDelete={onDelete}
                    onVersionHistory={onVersionHistory}
                    isDraft={isDraft}
                    pageLink={pageLink}
                    isOutlineVisible={isOutlineVisible}
                />
            )}
        </>
    );
};

export default PageActionsMenu;
