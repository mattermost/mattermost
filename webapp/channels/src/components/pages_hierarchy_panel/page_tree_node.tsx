// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback, useEffect, useRef} from 'react';
import {useSelector} from 'react-redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import WithTooltip from 'components/with_tooltip';

import {PageDisplayTypes} from 'utils/constants';
import {isEditingExistingPage} from 'utils/page_utils';

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
    onBookmarkInChannel?: (pageId: string) => void;
    onDelete?: (pageId: string) => void;
    isRenaming?: boolean;
    isDeleting?: boolean;
    wikiId?: string;
    channelId?: string;
    dragHandleProps?: any;
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
    onBookmarkInChannel,
    onDelete,
    isRenaming,
    isDeleting,
    wikiId,
    channelId,
    dragHandleProps,
}: Props) => {
    const currentTeam = useSelector((state: GlobalState) => getCurrentTeam(state));
    const isOutlineVisible = useSelector((state: GlobalState) =>
        state.views.pagesHierarchy.outlineExpandedNodes[node.id] || false,
    );

    const [showMenu, setShowMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState({x: 0, y: 0});
    const [isTitleTruncated, setIsTitleTruncated] = useState(false);
    const titleButtonRef = useRef<HTMLButtonElement>(null);

    const isLoading = isRenaming || isDeleting;

    const paddingLeft = (node.depth * 20) + 8;

    // Build the link path for the page
    const pageLink = wikiId && channelId ? `/${currentTeam?.name || 'team'}/wiki/${channelId}/${wikiId}/${node.id}` : '#';

    // Get appropriate aria label for icon button
    const getIconButtonLabel = () => {
        if (!node.hasChildren) {
            return 'Select page';
        }
        return node.isExpanded ? 'Collapse' : 'Expand';
    };

    useEffect(() => {
        const checkTruncation = () => {
            const el = titleButtonRef.current;
            if (!el) {
                return;
            }
            setIsTitleTruncated(el.scrollWidth > el.clientWidth);
        };

        checkTruncation();
        window.addEventListener('resize', checkTruncation);
        return () => {
            window.removeEventListener('resize', checkTruncation);
        };
    }, [node.title]);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuPosition({x: e.clientX, y: e.clientY});
        setShowMenu(true);
    }, []);

    const handleMenuButtonClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setMenuPosition({x: rect.left, y: rect.bottom});
        setShowMenu(true);
    }, []);

    return (
        <div
            className={`PageTreeNode ${isSelected ? 'PageTreeNode--selected' : ''} ${isLoading ? 'PageTreeNode--loading' : ''}`}
            style={{paddingLeft: `${paddingLeft}px`, opacity: isLoading ? 0.6 : 1}}
            data-testid='page-tree-node'
            data-page-id={node.id}
            data-is-draft={node.page.type === PageDisplayTypes.PAGE_DRAFT}
            onContextMenu={handleContextMenu}
        >
            {/* Drag handle - separate from selection */}
            {!isLoading && (
                <div
                    className='PageTreeNode__dragHandle'
                    {...dragHandleProps}
                    title='Drag to move'
                >
                    <i className='icon-drag-vertical'/>
                </div>
            )}

            {/* Page icon for leaf nodes, chevron for nodes with children */}
            {isLoading ? (
                <i className='PageTreeNode__icon icon-loading icon-spin'/>
            ) : (
                <button
                    className='PageTreeNode__iconButton'
                    onClick={(e) => {
                        e.stopPropagation();
                        if (node.hasChildren) {
                            onToggleExpand();
                        } else {
                            onSelect();
                        }
                    }}
                    aria-label={getIconButtonLabel()}
                    disabled={isLoading}
                    data-testid='page-tree-node-expand-button'
                >
                    {node.hasChildren ? (
                        <i className={`PageTreeNode__icon icon-chevron-${node.isExpanded ? 'down' : 'right'}`}/>
                    ) : (
                        <i className='PageTreeNode__icon icon-file-generic-outline'/>
                    )}
                </button>
            )}

            {/* Page title */}
            <WithTooltip
                title={node.title}
                disabled={!isTitleTruncated}
            >
                <button
                    ref={titleButtonRef}
                    className='PageTreeNode__title-button'
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!isLoading) {
                            onSelect();
                        }
                    }}
                    disabled={isLoading}
                    data-testid='page-tree-node-title'
                >
                    <span className='PageTreeNode__title'>
                        {node.title}
                    </span>
                </button>
            </WithTooltip>

            {/* Draft badge - only show for new drafts, not when editing existing pages */}
            {node.page.type === PageDisplayTypes.PAGE_DRAFT && !isEditingExistingPage(node.page as any) && (
                <span
                    className='PageTreeNode__draftBadge'
                    data-testid='draft-badge'
                >
                    {'Draft'}
                </span>
            )}

            {/* Context menu button - shows on hover */}
            {!isLoading && (
                <button
                    className='PageTreeNode__menuButton'
                    aria-label='Page menu'
                    title='Page menu'
                    onClick={handleMenuButtonClick}
                    data-testid='page-tree-node-menu-button'
                >
                    <i className='icon-dots-horizontal'/>
                </button>
            )}

            {/* Context menu */}
            {showMenu && (
                <PageContextMenu
                    pageId={node.id}
                    wikiId={wikiId}
                    position={menuPosition}
                    onClose={() => setShowMenu(false)}
                    onCreateChild={() => onCreateChild?.(node.id)}
                    onRename={() => onRename?.(node.id)}
                    onDuplicate={() => onDuplicate?.(node.id)}
                    onMove={() => onMove?.(node.id)}
                    onBookmarkInChannel={() => onBookmarkInChannel?.(node.id)}
                    onDelete={() => onDelete?.(node.id)}
                    isDraft={node.page.type === PageDisplayTypes.PAGE_DRAFT}
                    pageLink={pageLink}
                    isOutlineVisible={isOutlineVisible}
                />
            )}
        </div>
    );
};

export default React.memo(PageTreeNode);
