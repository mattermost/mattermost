// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {getMoreFilesForSearch, getMorePostsForSearch} from 'mattermost-redux/actions/search';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import {filterFilesSearchByExt, showChannelFiles, showSearchResults, updateSearchTeam as updateSearchTeamAction, updateSearchTerms as updateSearchTermsAction, updateSearchType as updateSearchTypeAction} from 'actions/views/rhs';
import {getExplicitSearchTeam, getRhsState, getSearchTeam, getSearchTerms} from 'selectors/rhs';

import type {SearchFilterType} from 'components/search/types';

import {RHSStates} from 'utils/constants';

import type {SearchType} from 'types/store/rhs';

export default function useSearchResultsActions() {
    const dispatch = useDispatch();
    const searchTeam = useSelector(getSearchTeam);
    const explicitSearchTeam = useSelector(getExplicitSearchTeam);
    const rhsState = useSelector(getRhsState);
    const searchTerms = useSelector(getSearchTerms);
    const currentChannel = useSelector(getCurrentChannel);
    const isMentionSearch = rhsState === RHSStates.MENTION;
    const isChannelFiles = rhsState === RHSStates.CHANNEL_FILES;

    const [searchFilterType, setSearchFilterType] = useState<SearchFilterType>('all');

    // Mentions are searched across every team unless the search was scoped to one, in which case
    // paging has to stay on that team to match the search the results came from.
    const isAllTeamsSearch = isMentionSearch && !explicitSearchTeam;

    const getMorePostsForSearchCallback = useCallback(() => {
        dispatch(getMorePostsForSearch(isAllTeamsSearch ? '' : searchTeam));
    }, [dispatch, isAllTeamsSearch, searchTeam]);

    const getMoreFilesForSearchCallback = useCallback(() => {
        dispatch(getMoreFilesForSearch(isAllTeamsSearch ? '' : searchTeam));
    }, [dispatch, isAllTeamsSearch, searchTeam]);

    const handleSetSearchFilter = useCallback((filterType: SearchFilterType) => {
        switch (filterType) {
        case 'documents':
            dispatch(filterFilesSearchByExt(['doc', 'pdf', 'docx', 'odt', 'rtf', 'txt']));
            break;
        case 'spreadsheets':
            dispatch(filterFilesSearchByExt(['xls', 'xlsx', 'ods']));
            break;
        case 'presentations':
            dispatch(filterFilesSearchByExt(['ppt', 'pptx', 'odp']));
            break;
        case 'code':
            dispatch(filterFilesSearchByExt(['py', 'go', 'java', 'kt', 'c', 'cpp', 'h', 'html', 'js', 'ts', 'cs', 'vb', 'php', 'pl', 'r', 'rb', 'sql', 'swift', 'json']));
            break;
        case 'images':
            dispatch(filterFilesSearchByExt(['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'svg', 'xcf']));
            break;
        case 'audio':
            dispatch(filterFilesSearchByExt(['ogg', 'mp3', 'wav', 'flac']));
            break;
        case 'video':
            dispatch(filterFilesSearchByExt(['ogm', 'mp4', 'avi', 'webm', 'mov', 'mkv', 'mpeg', 'mpg']));
            break;
        default:
            dispatch(filterFilesSearchByExt([]));
        }

        setSearchFilterType(filterType);
        if (isChannelFiles && currentChannel?.id) {
            dispatch(showChannelFiles(currentChannel.id));
        } else {
            dispatch(showSearchResults(false));
        }
    }, [dispatch, isChannelFiles, currentChannel?.id]);

    const handleUpdateSearchTerms = useCallback((term: string) => {
        const pretextArray = searchTerms?.split(' ') || [];
        pretextArray.pop();
        pretextArray.push(term.toLowerCase());
        dispatch(updateSearchTermsAction(pretextArray.join(' ')));
    }, [dispatch, searchTerms]);

    const handleSetSearchType = useCallback((type: SearchType) => {
        dispatch(updateSearchTypeAction(type));
    }, [dispatch]);

    const handleUpdateSearchTeam = useCallback((teamId: string): string => {
        dispatch(updateSearchTeamAction(teamId));

        // When we switch teams, we need to remove the in: and from: filters from the search terms
        // since the channel and user filters might not be valid for the new team.
        const cleanedTerms = searchTerms.
            replace(/\bin:[^\s]*/gi, '').replace(/\s{2,}/g, ' ').
            replace(/\bfrom:[^\s]*/gi, '').replace(/\s{2,}/g, ' ').
            trim();

        if (cleanedTerms.trim() !== searchTerms.trim()) {
            dispatch(updateSearchTermsAction(cleanedTerms));
        }

        dispatch(showSearchResults(isMentionSearch));

        return cleanedTerms;
    }, [dispatch, searchTerms, isMentionSearch]);

    return {
        searchFilterType,
        getMorePostsForSearch: getMorePostsForSearchCallback,
        getMoreFilesForSearch: getMoreFilesForSearchCallback,
        setSearchFilterType: handleSetSearchFilter,
        updateSearchTerms: handleUpdateSearchTerms,
        updateSearchTeam: handleUpdateSearchTeam,
        setSearchType: handleSetSearchType,
    };
}
