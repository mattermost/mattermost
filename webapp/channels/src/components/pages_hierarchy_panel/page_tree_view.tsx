// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useCallback} from 'react';
import {useSelector} from 'react-redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import type {GlobalState} from 'types/store';

import HeadingNode from './heading_node';
import PageTreeNode from './page_tree_node';
import type {TreeNode} from './utils/tree_builder';
import {flattenTree, type FlatNode} from './utils/tree_flattener';

import './page_tree_view.scss';

type NodeWrapperProps = {
    node: FlatNode;
    isSelected: boolean;
    onNodeSelect: (nodeId: string) => void;
    onToggleExpand: (nodeId: string) => void;
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

const PageTreeNodeWrapper = React.memo(({
    node,
    isSelected,
    onNodeSelect,
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
}: NodeWrapperProps) => {
    const handleSelect = useCallback(() => onNodeSelect(node.id), [onNodeSelect, node.id]);
    const handleToggleExpand = useCallback(() => onToggleExpand(node.id), [onToggleExpand, node.id]);

    return (
        <PageTreeNode
            node={node}
            isSelected={isSelected}
            onSelect={handleSelect}
            onToggleExpand={handleToggleExpand}
            onCreateChild={onCreateChild}
            onRename={onRename}
            onDuplicate={onDuplicate}
            onMove={onMove}
            onDelete={onDelete}
            isRenaming={isRenaming}
            isDeleting={isDeleting}
            wikiId={wikiId}
            channelId={channelId}
        />
    );
});

type Props = {
    tree: TreeNode[];
    expandedNodes: {[pageId: string]: boolean};
    selectedPageId: string | null;
    currentPageId?: string;
    onNodeSelect: (nodeId: string) => void;
    onToggleExpand: (nodeId: string) => void;
    onCreateChild?: (pageId: string) => void;
    onRename?: (pageId: string) => void;
    onDuplicate?: (pageId: string) => void;
    onMove?: (pageId: string) => void;
    onDelete?: (pageId: string) => void;
    renamingPageId?: string | null;
    deletingPageId?: string | null;
    wikiId?: string;
    channelId?: string;
};

const PageTreeView = ({
    tree,
    expandedNodes,
    selectedPageId,
    currentPageId,
    onNodeSelect,
    onToggleExpand,
    onCreateChild,
    onRename,
    onDuplicate,
    onMove,
    onDelete,
    renamingPageId,
    deletingPageId,
    wikiId,
    channelId,
}: Props) => {
    const currentTeam = useSelector(getCurrentTeam);
    const outlineExpandedNodes = useSelector((state: GlobalState) => state.views.pagesHierarchy.outlineExpandedNodes);
    const outlineCache = useSelector((state: GlobalState) => state.views.pagesHierarchy.outlineCache);

    // Flatten tree for rendering, respecting expanded state
    const visibleNodes = useMemo(
        () => flattenTree(tree, expandedNodes),
        [tree, expandedNodes],
    );

    if (visibleNodes.length === 0) {
        return (
            <div className='PageTreeView__empty'>
                {'No pages found'}
            </div>
        );
    }

    return (
        <div className='PageTreeView'>
            {visibleNodes.map((node) => {
                const isOutlineExpanded = outlineExpandedNodes[node.id];
                const headings = isOutlineExpanded ? outlineCache[node.id] || [] : [];

                return (
                    <React.Fragment key={node.id}>
                        <PageTreeNodeWrapper
                            node={node}
                            isSelected={node.id === selectedPageId}
                            onNodeSelect={onNodeSelect}
                            onToggleExpand={onToggleExpand}
                            onCreateChild={onCreateChild}
                            onRename={onRename}
                            onDuplicate={onDuplicate}
                            onMove={onMove}
                            onDelete={onDelete}
                            isRenaming={renamingPageId === node.id}
                            isDeleting={deletingPageId === node.id}
                            wikiId={wikiId}
                            channelId={channelId}
                        />
                        {isOutlineExpanded && (
                            <div className='PageTreeView__outline'>
                                {headings.length > 0 ? (
                                    <>
                                        {headings.map((heading) => (
                                            <HeadingNode
                                                key={`${node.id}-${heading.id}`}
                                                heading={heading}
                                                pageId={node.id}
                                                currentPageId={currentPageId}
                                                teamName={currentTeam?.name || ''}
                                            />
                                        ))}
                                    </>
                                ) : (
                                    <div className='PageTreeView__outline-empty'>
                                        {'No headings in this page'}
                                    </div>
                                )}
                            </div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default React.memo(PageTreeView);
