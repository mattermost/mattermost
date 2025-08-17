// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type React from 'react';
import type {Action} from 'redux';

import type {UserAutocomplete} from '@mattermost/types/autocomplete';
import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import type {SearchType} from 'types/store/rhs';

export type SearchFilterType = 'all' | 'documents' | 'spreadsheets' | 'presentations' | 'code' | 'images' | 'audio' | 'video';

export type OwnProps = {
    isSideBarRight?: boolean;
    isSideBarRightOpen?: boolean;
    hideSearchBar?: boolean;
    enableFindShortcut?: boolean;
    channelDisplayName?: string;
    getFocus?: (searchBarFocus: () => void) => void;
    children?: React.ReactNode;
}

export type StateProps = {
    isRhsExpanded: boolean;
    isSearchingTerm: boolean;
    searchTerms: string;
    searchTeam: string;
    searchType: SearchType;
    searchVisible: boolean;
    hideMobileSearchBarInRHS: boolean;
    isMentionSearch: boolean;
    isFlaggedPosts: boolean;
    isPinnedPosts: boolean;
    isChannelFiles: boolean;
    currentChannel?: Channel;
    isMobileView: boolean;
    crossTeamSearchEnabled: boolean;
}

export type DispatchProps = {
    actions: {
        updateSearchTerms: (term: string) => Action;
        updateSearchTeam: (teamId: string|null) => Action;
        updateSearchTermsForShortcut: () => void;
        updateSearchType: (searchType: string) => Action;
        showSearchResults: (isMentionSearch: boolean) => unknown;
        showChannelFiles: (channelId: string) => void;
        setRhsExpanded: (expanded: boolean) => Action;
        closeRightHandSide: () => void;
        autocompleteChannelsForSearch: (term: string, teamId: string, success?: (channels: Channel[]) => void, error?: (err: ServerError) => void) => void;
        autocompleteUsersInTeam: (username: string) => Promise<UserAutocomplete>;
        updateRhsState: (rhsState: string) => void;
        getMorePostsForSearch: (teamId: string) => void;
        openRHSSearch: () => void;
        getMoreFilesForSearch: (teamId: string) => void;
        filterFilesSearchByExt: (extensions: string[]) => void;
    };
}

export type Props = StateProps & DispatchProps & OwnProps;
