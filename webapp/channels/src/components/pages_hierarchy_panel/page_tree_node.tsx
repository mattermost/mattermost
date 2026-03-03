// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import type {DraggableProvidedDragHandleProps} from 'react-beautiful-dnd';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import WithTooltip from 'components/with_tooltip';

import {PageDisplayTypes} from 'utils/constants';
import {isEditingExistingPage} from 'utils/page_utils';
import {getWikiUrl} from 'utils/url';

import type {GlobalState} from 'types/store';

import PageActionsMenu from './page_actions_menu';
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
    onVersionHistory?: (pageId: string) => void;
    onCopyMarkdown?: (pageId: string) => void;
    isRenaming?: boolean;
    isDeleting?: boolean;
    wikiId?: string;
    channelId?: string;
    dragHandleProps?: DraggableProvidedDragHandleProps | null;
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
    onVersionHistory,
    onCopyMarkdown,
    isRenaming,
    isDeleting,
    wikiId,
    channelId,
    dragHandleProps,
}: Props) => {
    const {formatMessage} = useIntl();
    const currentTeam = useSelector((state: GlobalState) => getCurrentTeam(state));

    const [isTitleTruncated, setIsTitleTruncated] = useState(false);
    const titleButtonRef = useRef<HTMLButtonElement>(null);

    const isLoading = isRenaming || isDeleting;

    const paddingLeft = (node.depth * 20) + 8;
    const teamName = currentTeam?.name || 'team';

    // Build the link path for the page
    const pageLink = wikiId && channelId ? getWikiUrl(teamName, channelId, wikiId, node.id) : '#';

    // Get appropriate aria label for icon button
    const getIconButtonLabel = () => {
        if (!node.hasChildren) {
            return formatMessage({id: 'pages_hierarchy.tree_node.select_page', defaultMessage: 'Select page'});
        }
        return node.isExpanded ?
            formatMessage({id: 'pages_hierarchy.tree_node.collapse', defaultMessage: 'Collapse'}) :
            formatMessage({id: 'pages_hierarchy.tree_node.expand', defaultMessage: 'Expand'});
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

    const handleCreateChild = useCallback(() => onCreateChild?.(node.id), [onCreateChild, node.id]);
    const handleRename = useCallback(() => onRename?.(node.id), [onRename, node.id]);
    const handleDuplicate = useCallback(() => onDuplicate?.(node.id), [onDuplicate, node.id]);
    const handleMove = useCallback(() => onMove?.(node.id), [onMove, node.id]);
    const handleBookmarkInChannel = useCallback(() => onBookmarkInChannel?.(node.id), [onBookmarkInChannel, node.id]);
    const handleDelete = useCallback(() => onDelete?.(node.id), [onDelete, node.id]);
    const handleVersionHistory = useCallback(() => onVersionHistory?.(node.id), [onVersionHistory, node.id]);
    const handleCopyMarkdown = useCallback(() => onCopyMarkdown?.(node.id), [onCopyMarkdown, node.id]);

    return (
        <div
            className={`PageTreeNode ${isSelected ? 'PageTreeNode--selected' : ''} ${isLoading ? 'PageTreeNode--loading' : ''}`}
            style={{paddingLeft: `${paddingLeft}px`, opacity: isLoading ? 0.6 : 1}}
            data-testid='page-tree-node'
            data-page-id={node.id}
            data-depth={node.depth}
            data-is-draft={node.page.type === PageDisplayTypes.PAGE_DRAFT}
        >
            {/* Drag handle - separate from selection */}
            {!isLoading && (
                <div
                    className='PageTreeNode__dragHandle'
                    {...dragHandleProps}
                    title={formatMessage({id: 'page_tree_node.drag_to_move', defaultMessage: 'Drag to move'})}
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
            {node.page.type === PageDisplayTypes.PAGE_DRAFT && !isEditingExistingPage(node.page) && (
                <span
                    className='PageTreeNode__draftBadge'
                    data-testid='draft-badge'
                >
                    <FormattedMessage
                        id='wiki.page_tree_node.draft_badge'
                        defaultMessage='Draft'
                    />
                </span>
            )}

            {/* Context menu */}
            {!isLoading && (
                <PageActionsMenu
                    pageId={node.id}
                    wikiId={wikiId}
                    onCreateChild={handleCreateChild}
                    onRename={handleRename}
                    onDuplicate={handleDuplicate}
                    onMove={handleMove}
                    onBookmarkInChannel={handleBookmarkInChannel}
                    onDelete={handleDelete}
                    onVersionHistory={handleVersionHistory}
                    onCopyMarkdown={handleCopyMarkdown}
                    isDraft={node.page.type === PageDisplayTypes.PAGE_DRAFT}
                    canDuplicate={node.page.type !== PageDisplayTypes.PAGE_DRAFT || isEditingExistingPage(node.page)}
                    pageLink={pageLink}
                    buttonClassName='PageTreeNode__menuButton'
                    buttonLabel='Page menu'
                    buttonTestId='page-tree-node-menu-button'
                />
            )}
        </div>
    );
};

export default React.memo(PageTreeNode);
