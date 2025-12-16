// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {
    toggleNodeExpanded,
    expandAncestors,
    togglePagesPanel,
    openPagesPanel,
    closePagesPanel,
    setLastViewedPage,
} from 'actions/views/pages_hierarchy';
import {
    getPagesTree,
    getExpandedNodes,
    getIsPanesPanelCollapsed,
    getLastViewedPage,
} from 'selectors/pages_hierarchy';

import type {GlobalState} from 'types/store';

/**
 * Hook to manage pages hierarchy for a wiki.
 * Provides tree structure, expansion state, and navigation operations.
 *
 * @param wikiId - Wiki ID
 * @returns Hierarchy tree, state, and operations
 */
export function usePagesHierarchy(wikiId: string) {
    const dispatch = useDispatch();

    const tree = useSelector((state: GlobalState) => getPagesTree(state, wikiId));
    const expandedNodes = useSelector((state: GlobalState) => getExpandedNodes(state, wikiId));
    const isPanelCollapsed = useSelector(getIsPanesPanelCollapsed);
    const lastViewedPage = useSelector((state: GlobalState) => getLastViewedPage(state, wikiId));

    const toggleExpanded = useCallback((nodeId: string) => {
        dispatch(toggleNodeExpanded(wikiId, nodeId));
    }, [dispatch, wikiId]);

    const expandNodeAncestors = useCallback((ancestorIds: string[]) => {
        dispatch(expandAncestors(wikiId, ancestorIds));
    }, [dispatch, wikiId]);

    const togglePanel = useCallback(() => {
        dispatch(togglePagesPanel());
    }, [dispatch]);

    const openPanel = useCallback(() => {
        dispatch(openPagesPanel());
    }, [dispatch]);

    const closePanel = useCallback(() => {
        dispatch(closePagesPanel());
    }, [dispatch]);

    const setLastViewed = useCallback((pageId: string) => {
        dispatch(setLastViewedPage(wikiId, pageId));
    }, [dispatch, wikiId]);

    const isExpanded = useCallback((nodeId: string) => {
        return expandedNodes[nodeId] || false;
    }, [expandedNodes]);

    return {
        tree,
        expandedNodes,
        isPanelCollapsed,
        lastViewedPage,
        toggleExpanded,
        expandNodeAncestors,
        togglePanel,
        openPanel,
        closePanel,
        setLastViewed,
        isExpanded,
    };
}
