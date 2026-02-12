// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {Team} from '@mattermost/types/teams';

import type {RhsState, SearchType} from './rhs';

/**
 * Panel types for Open RHS Panels feature.
 * Maps to RHSStates but also includes 'thread' for thread views.
 */
export type RhsPanelType =
    | 'thread'
    | 'search'
    | 'mention'
    | 'flag'
    | 'pin'
    | 'channel_files'
    | 'channel_info'
    | 'channel_members'
    | 'plugin'
    | 'edit_history';

/**
 * State for an individual RHS panel.
 * Each panel has isolated state to support viewing threads/content
 * from different channels simultaneously.
 */
export type RhsPanelState = {

    /** Unique panel identifier */
    id: string;

    /** Panel type determines rendering and icon */
    type: RhsPanelType;

    /** Thread root post ID (for thread panels) */
    selectedPostId: Post['id'];

    /** Timestamp of last focus */
    selectedPostFocussedAt: number;

    /** Post card ID (for card view panels) */
    selectedPostCardId: Post['id'];

    /**
     * Channel context for this panel.
     * CRITICAL: This isolates channel state so threads from other channels
     * don't pollute the current channel context.
     */
    selectedChannelId: Channel['id'];

    /** Post to highlight/flash */
    highlightedPostId: Post['id'];

    /** Back navigation stack for this panel */
    previousRhsStates: RhsState[];

    /** Current RHS state mode */
    rhsState: RhsState;

    // Search-specific state
    searchTerms: string;
    searchTeam: Team['id'] | null;
    searchType: SearchType;
    searchResultsTerms: string;
    searchResultsType: string;
    filesSearchExtFilter: string[];

    // Plugin-specific state
    pluggableId: string;

    // Panel metadata
    /** Display title for AppBar tooltip */
    title: string;

    /** Whether panel is minimized (hidden but still in AppBar) */
    minimized: boolean;

    /** Creation timestamp for ordering */
    createdAt: number;
};

/**
 * State for managing multiple RHS panels.
 */
export type RhsPanelsState = {

    /** All open panels indexed by ID */
    panels: Record<string, RhsPanelState>;

    /** Currently visible panel ID (null if all minimized or none open) */
    activePanelId: string | null;

    /** Order of panel IDs for AppBar display */
    panelOrder: string[];
};

/**
 * Creates a new panel state with defaults.
 */
export function createPanelState(
    id: string,
    type: RhsPanelType,
    overrides: Partial<RhsPanelState> = {},
): RhsPanelState {
    return {
        id,
        type,
        selectedPostId: '',
        selectedPostFocussedAt: 0,
        selectedPostCardId: '',
        selectedChannelId: '',
        highlightedPostId: '',
        previousRhsStates: [],
        rhsState: null,
        searchTerms: '',
        searchTeam: null,
        searchType: '',
        searchResultsTerms: '',
        searchResultsType: '',
        filesSearchExtFilter: [],
        pluggableId: '',
        title: '',
        minimized: false,
        createdAt: Date.now(),
        ...overrides,
    };
}

/**
 * Maps RHSStates constant values to RhsPanelType.
 */
export function rhsStateToPanelType(rhsState: RhsState): RhsPanelType | null {
    switch (rhsState) {
    case 'mention':
        return 'mention';
    case 'search':
        return 'search';
    case 'flag':
        return 'flag';
    case 'pin':
        return 'pin';
    case 'plugin':
        return 'plugin';
    case 'channel-files':
        return 'channel_files';
    case 'channel-info':
        return 'channel_info';
    case 'channel-members':
        return 'channel_members';
    case 'edit-history':
        return 'edit_history';
    default:
        return null;
    }
}

/**
 * Gets the icon name for a panel type.
 */
export function getPanelIcon(type: RhsPanelType): string {
    switch (type) {
    case 'thread':
        return 'message-text-outline';
    case 'search':
        return 'magnify';
    case 'mention':
        return 'at';
    case 'flag':
        return 'bookmark-outline';
    case 'pin':
        return 'pin-outline';
    case 'channel_files':
        return 'file-multiple-outline';
    case 'channel_info':
        return 'information-outline';
    case 'channel_members':
        return 'account-multiple-outline';
    case 'plugin':
        return 'power-plug-outline';
    case 'edit_history':
        return 'history';
    default:
        return 'dock-right';
    }
}
