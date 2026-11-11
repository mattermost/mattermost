// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useLocation} from 'react-router-dom';

import {getChannelByName} from 'mattermost-redux/selectors/entities/channels';
import {getIsCrossTeamSearchEnabled} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {showChannelFiles, showFlaggedPosts, showMentions, showPinnedPosts, showSearchResults, updateRhsState, updateSearchTeam, updateSearchTerms, updateSearchType} from 'actions/views/rhs';
import {getIsRhsExpanded, getRhsState} from 'selectors/rhs';

import useSearchResultsActions from 'components/common/hooks/use_search_results_actions';
import SearchResults from 'components/search_results';

import {getHistory} from 'utils/browser_history';
import {RHSStates} from 'utils/constants';
import usePopoutTitle from 'utils/popouts/use_popout_title';

import type {GlobalState} from 'types/store';
import type {RhsState, SearchType} from 'types/store/rhs';

import {getSearchPopoutTitle} from './title';

export default function RhsSearchPopout() {
    const dispatch = useDispatch();
    const location = useLocation();

    const teamId = useSelector(getCurrentTeamId);

    const query = useMemo(() => {
        const queryParams = new URLSearchParams(location.search);
        const searchTerms = queryParams.get('q') ?? '';
        const searchType = queryParams.get('type') as SearchType;
        const mode = queryParams.get('mode') as NonNullable<RhsState>;
        const channelIdentifier = queryParams.get('channel') ?? '';
        const searchTeamId = queryParams.get('searchTeamId');

        return {
            mode,
            searchTerms,
            searchType,
            channelIdentifier,
            searchTeamId,
        };
    }, [location.search]);

    const channel = useSelector((state: GlobalState) => (query.channelIdentifier ? getChannelByName(state, query.channelIdentifier) : undefined));
    const rhsState = useSelector(getRhsState);
    const isRhsExpanded = useSelector(getIsRhsExpanded);
    const crossTeamSearchEnabled = useSelector(getIsCrossTeamSearchEnabled);
    const searchActions = useSearchResultsActions();

    const popoutTitle = useMemo(() => getSearchPopoutTitle(query.mode), [query.mode]);
    const popoutTitleParams = useMemo(() => ({searchTerms: query.searchTerms}), [query.searchTerms]);
    usePopoutTitle(popoutTitle, popoutTitleParams);

    const channelId = channel?.id;
    const channelDisplayName = channel?.display_name ?? '';
    const isMentionSearch = rhsState === RHSStates.MENTION;
    const isFlaggedPosts = rhsState === RHSStates.FLAG;
    const isPinnedPosts = rhsState === RHSStates.PIN;
    const isChannelFiles = rhsState === RHSStates.CHANNEL_FILES;

    useEffect(() => {
        if (!teamId) {
            return;
        }

        dispatch(updateSearchType(query.searchType));
        dispatch(updateSearchTerms(query.searchTerms));
        dispatch(updateSearchTeam(query.searchTeamId ?? teamId));

        switch (query.mode) {
        case RHSStates.CHANNEL_FILES:
            if (channelId) {
                dispatch(showChannelFiles(channelId));
                return;
            }
            break;
        case RHSStates.MENTION:
            if (query.searchTerms.trim()) {
                dispatch(showSearchResults(true));
            } else {
                dispatch(showMentions());
            }
            return;
        case RHSStates.FLAG:
            dispatch(showFlaggedPosts());
            return;
        case RHSStates.PIN:
            if (channelId) {
                dispatch(showPinnedPosts(channelId));
                return;
            }
            break;
        default:
            if (query.searchTerms) {
                dispatch(showSearchResults(false));
                return;
            }
            break;
        }

        dispatch(updateRhsState(query.mode, channelId));
    }, [dispatch, query, channelId, teamId]);

    const handleUpdateSearchTeam = useCallback((newTeamId: string) => {
        const cleanedTerms = searchActions.updateSearchTeam(newTeamId);

        const params = new URLSearchParams(window.location.search);
        params.set('searchTeamId', newTeamId);

        const currentTerms = params.get('q') ?? '';
        if (cleanedTerms.trim() !== currentTerms.trim()) {
            params.set('q', cleanedTerms);
        }
        getHistory().replace(`${window.location.pathname}?${params.toString()}`);
    }, [searchActions]);

    return (
        <SearchResults
            isMentionSearch={isMentionSearch}
            isFlaggedPosts={isFlaggedPosts}
            isPinnedPosts={isPinnedPosts}
            isChannelFiles={isChannelFiles}
            isSideBarExpanded={isRhsExpanded}
            isOpened={true}
            channelDisplayName={channelDisplayName}
            updateSearchTerms={searchActions.updateSearchTerms}
            updateSearchTeam={handleUpdateSearchTeam}
            getMorePostsForSearch={searchActions.getMorePostsForSearch}
            getMoreFilesForSearch={searchActions.getMoreFilesForSearch}
            setSearchFilterType={searchActions.setSearchFilterType}
            searchFilterType={searchActions.searchFilterType}
            searchType={query.searchType}
            crossTeamSearchEnabled={crossTeamSearchEnabled}
        />
    );
}

