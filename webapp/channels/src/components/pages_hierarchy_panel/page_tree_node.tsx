// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useSelector} from 'react-redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {PageDisplayTypes} from 'utils/constants';

import type {GlobalState} from 'types/store';

import PageContextMenu from './page_context_menu';
import type {FlatNode} from './utils/tree_flattener';

import './page_tree_node.scss';

type Props = {
    node: FlatNode;
    isSelected: boolean;
    onSelect: () => void;
    onToggleExpand: () => void;
    onCreateChild?: (pageId: string) => void;
    onRename?: (pageId: string) => void;
    onDuplicate?: (pageId: string) => void;
    onMove?: (pageId: string) => void;
    onDelete?: (pageId: string) => void;
    isRenaming?: boolean;
    isDeleting?: boolean;
    wikiId?: string;
    channelId?: string;
};

const PageTreeNode = ({
    node,
    isSelected,
    onSelect,
    onToggleExpand,
    onCreateChild,
    onRename,
    onDuplicate,
    onMove,
    onDelete,
    isRenaming,
    isDeleting,
    wikiId,
    channelId,
}: Props) => {
    const [showMenu, setShowMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState({x: 0, y: 0});
    const currentTeam = useSelector((state: GlobalState) => getCurrentTeam(state));

    const isLoading = isRenaming || isDeleting;

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setMenuPosition({x: e.clientX, y: e.clientY});
        setShowMenu(true);
    };

    const handleMenuButtonClick = (e: React.MouseEvent) => {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        setMenuPosition({x: rect.left, y: rect.bottom});
        setShowMenu(true);
    };

    const paddingLeft = (node.depth * 20) + 16;

    // Build the link path for the page
    const pageLink = wikiId && channelId ? `/${currentTeam?.name || 'team'}/wiki/${channelId}/${wikiId}/${node.id}` : '#';

    return (
        <div
            className={`PageTreeNode ${isSelected ? 'PageTreeNode--selected' : ''} ${isLoading ? 'PageTreeNode--loading' : ''}`}
            style={{paddingLeft: `${paddingLeft}px`, opacity: isLoading ? 0.6 : 1}}
            onClick={() => {
                if (isLoading) {
                    return;
                }
                onSelect();
            }}
            onContextMenu={isLoading ? undefined : handleContextMenu}
        >
            {/* Expand/collapse button - only if has children */}
            {node.hasChildren ? (
                <button
                    className='PageTreeNode__expandButton'
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleExpand();
                    }}
                    aria-label={node.isExpanded ? 'Collapse' : 'Expand'}
                    disabled={isLoading}
                >
                    <i className={`icon-chevron-${node.isExpanded ? 'down' : 'right'}`}/>
                </button>
            ) : (
                <div className='PageTreeNode__expandSpacer'/>
            )}

            {/* Page icon or loading spinner */}
            {isLoading ? (
                <i className='PageTreeNode__icon icon-loading icon-spin'/>
            ) : (
                <i className='PageTreeNode__icon icon-file-document-outline'/>
            )}

            {/* Page title */}
            <span className='PageTreeNode__title'>{node.title}</span>

            {/* Draft badge */}
            {node.page.type === PageDisplayTypes.PAGE_DRAFT && (
                <span className='PageTreeNode__draftBadge'>{'Draft'}</span>
            )}

            {/* Context menu button - shows on hover */}
            {!isLoading && (
                <button
                    className='PageTreeNode__menuButton'
                    onClick={(e) => {
                        e.stopPropagation();
                        handleMenuButtonClick(e);
                    }}
                    aria-label='Page menu'
                >
                    <i className='icon-dots-vertical'/>
                </button>
            )}

            {/* Context menu */}
            {showMenu && (
                <PageContextMenu
                    pageId={node.id}
                    position={menuPosition}
                    onClose={() => setShowMenu(false)}
                    onCreateChild={() => onCreateChild?.(node.id)}
                    onRename={() => onRename?.(node.id)}
                    onDuplicate={() => onDuplicate?.(node.id)}
                    onMove={() => onMove?.(node.id)}
                    onDelete={() => onDelete?.(node.id)}
                    isDraft={node.page.type === PageDisplayTypes.PAGE_DRAFT}
                    pageLink={pageLink}
                />
            )}
        </div>
    );
};

export default React.memo(PageTreeNode);
