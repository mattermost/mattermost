// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useCallback, useState} from 'react';
import {useSelector, useDispatch} from 'react-redux';
import {DragDropContext, Droppable, Draggable, type DropResult} from 'react-beautiful-dnd';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {movePageInHierarchy} from 'actions/pages';

import type {GlobalState} from 'types/store';

import HeadingNode from './heading_node';
import PageTreeNode from './page_tree_node';
import type {TreeNode} from './utils/tree_builder';
import {isDescendant} from './utils/tree_builder';
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
    const dispatch = useDispatch();
    const currentTeam = useSelector(getCurrentTeam);
    const outlineExpandedNodes = useSelector((state: GlobalState) => state.views.pagesHierarchy.outlineExpandedNodes);
    const outlineCache = useSelector((state: GlobalState) => state.views.pagesHierarchy.outlineCache);

    // Local state for drag operations
    const [isDragging, setIsDragging] = useState(false);

    // Flatten tree for rendering, respecting expanded state
    const visibleNodes = useMemo(
        () => flattenTree(tree, expandedNodes),
        [tree, expandedNodes],
    );

    // Build a lookup map for TreeNodes
    const nodeMap = useMemo(() => {
        const map = new Map<string, TreeNode>();
        const traverse = (nodes: TreeNode[]) => {
            nodes.forEach((node) => {
                map.set(node.id, node);
                if (node.children.length > 0) {
                    traverse(node.children);
                }
            });
        };
        traverse(tree);
        return map;
    }, [tree]);

    const handleDragEnd = useCallback((result: DropResult) => {
        const {draggableId, source, destination, combine} = result;
        setIsDragging(false);


        // Dropped outside valid drop zone
        if (!destination && !combine) {
            return;
        }

        // Determine drop type and target
        let newParentId: string | null = null;

        if (combine) {
            // Dropped ON another page (make it a child)
            newParentId = combine.draggableId;
        } else if (destination) {
            // Dropped BETWEEN pages (sibling reordering or parent change)
            const targetNode = visibleNodes[destination.index];

            // If dropping at same position, no-op
            if (source.index === destination.index) {
                return;
            }

            newParentId = targetNode.parentId;
        }

        const sourceNode = nodeMap.get(draggableId);
        const targetNode = newParentId ? nodeMap.get(newParentId) : null;


        // Prevent dropping on self or descendants
        if (sourceNode && targetNode && isDescendant(sourceNode, targetNode)) {
            return;
        }


        // Dispatch Redux action with optimistic update
        if (wikiId) {
            dispatch(movePageInHierarchy(draggableId, newParentId, wikiId));
        }
    }, [visibleNodes, nodeMap, wikiId, dispatch]);

    if (visibleNodes.length === 0) {
        return (
            <div className='PageTreeView__empty'>
                {'No pages found'}
            </div>
        );
    }

    return (
        <DragDropContext
            onDragEnd={handleDragEnd}
            onDragStart={() => setIsDragging(true)}
        >
            <Droppable
                droppableId='page-tree'
                type='PAGE'
                isCombineEnabled={true}
            >
                {(provided, snapshot) => (
                    <div
                        className={`PageTreeView ${snapshot.isDraggingOver ? 'PageTreeView--dragging-over' : ''}`}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                    >
                        {visibleNodes.map((node, index) => {
                            const isOutlineExpanded = outlineExpandedNodes[node.id];
                            const headings = isOutlineExpanded ? outlineCache[node.id] || [] : [];

                            return (
                                <Draggable
                                    key={node.id}
                                    draggableId={node.id}
                                    index={index}
                                >
                                    {(provided, snapshot) => {
                                        const isCombineTarget = snapshot.combineTargetFor;
                                        const className = [
                                            snapshot.isDragging && 'PageTreeView__node--dragging',
                                            isCombineTarget && 'PageTreeView__node--combine-target',
                                        ].filter(Boolean).join(' ');

                                        return (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                {...provided.dragHandleProps}
                                                className={className}
                                            >
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
                                        </div>
                                        );
                                    }}
                                </Draggable>
                            );
                        })}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </DragDropContext>
    );
};

export default React.memo(PageTreeView);
