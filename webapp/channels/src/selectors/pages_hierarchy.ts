// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from 'types/store';

// Get expanded nodes for a wiki
export function getExpandedNodes(state: GlobalState, wikiId: string): {[pageId: string]: boolean} {
    return state.views.pagesHierarchy.expandedNodes[wikiId] || {};
}

// Get selected page ID
export function getSelectedPageId(state: GlobalState): string | null {
    return state.views.pagesHierarchy.selectedPageId;
}

// Check if a specific node is expanded
export function isNodeExpanded(state: GlobalState, wikiId: string, nodeId: string): boolean {
    const expandedNodes = getExpandedNodes(state, wikiId);
    return expandedNodes[nodeId] || false;
}

// Get panel collapsed state
export function getIsPanesPanelCollapsed(state: GlobalState): boolean {
    return state.views.pagesHierarchy.isPanelCollapsed;
}

// Get last viewed page for a wiki
export function getLastViewedPage(state: GlobalState, wikiId: string): string | null {
    return state.views.pagesHierarchy.lastViewedPage[wikiId] || null;
}
