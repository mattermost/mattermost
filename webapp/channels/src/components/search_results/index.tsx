// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import type {FileSearchResultItem} from '@mattermost/types/files';
import type {Post} from '@mattermost/types/posts';
import type {OmniSearchResult} from '@mattermost/types/search';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getSearchFilesResults} from 'mattermost-redux/selectors/entities/files';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getSearchMatches, getSearchResults} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentSearchForCurrentTeam, getOmniSearchResults} from 'mattermost-redux/selectors/entities/search';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {
    getSearchResultsTerms,
    getSearchResultsType,
    getIsSearchingTerm,
    getIsSearchingFlaggedPost,
    getIsSearchingPinnedPost,
    getIsSearchGettingMore,
} from 'selectors/rhs';

import type {GlobalState} from 'types/store';

import SearchResults from './search_results';
import type {StateProps, OwnProps} from './types';

function makeMapStateToProps() {
    let results: Post[];
    let fileResults: FileSearchResultItem[];
    let files: FileSearchResultItem[] = [];
    let omniSearchResults: OmniSearchResult[] = [];
    let omniSearches: OmniSearchResult[] = [];
    let posts: Post[];

    return function mapStateToProps(state: GlobalState) {
        const config = getConfig(state);

        const viewArchivedChannels = config.ExperimentalViewArchivedChannels === 'true';

        const newResults = getSearchResults(state);

        // Cache posts and channels
        if (newResults && newResults !== results) {
            results = newResults;

            posts = [];
            results.forEach((post) => {
                if (!post) {
                    return;
                }

                posts.push(post);
            });
        }

        const newFilesResults = getSearchFilesResults(state);

        // Cache files and channels
        if (newFilesResults && newFilesResults !== fileResults) {
            fileResults = newFilesResults;

            files = [];
            fileResults.forEach((file) => {
                if (!file) {
                    return;
                }

                const channel = getChannel(state, file.channel_id);
                if (channel && channel.delete_at !== 0 && !viewArchivedChannels) {
                    return;
                }

                files.push(file);
            });
        }

        const newOmniSearchResults = getOmniSearchResults(state);

        // Cache omnisearches
        if (newOmniSearchResults && newOmniSearchResults !== omniSearchResults) {
            omniSearchResults = newOmniSearchResults;

            omniSearches = [];
            omniSearchResults.forEach((omniSearch) => {
                if (!omniSearch) {
                    return;
                }
                omniSearches.push(omniSearch);
            });
        }

        // this is basically a hack to make ts compiler happy
        // add correct type when it is known what exactly is returned from the function
        const currentSearch = getCurrentSearchForCurrentTeam(state) || {};
        const currentTeamName = getCurrentTeam(state)?.name ?? '';

        return {
            results: posts,
            fileResults: files,
            omniSearchResults: omniSearches,
            matches: getSearchMatches(state),
            searchTerms: getSearchResultsTerms(state),
            searchSelectedType: getSearchResultsType(state),
            isSearchingTerm: getIsSearchingTerm(state),
            isSearchingFlaggedPost: getIsSearchingFlaggedPost(state),
            isSearchingPinnedPost: getIsSearchingPinnedPost(state),
            isSearchGettingMore: getIsSearchGettingMore(state),
            isSearchAtEnd: currentSearch.isEnd,
            isSearchFilesAtEnd: currentSearch.isFilesEnd,
            isOmniSearchAtEnd: currentSearch.isOmniSearchAtEnd,
            searchPage: currentSearch.params?.page,
            currentTeamName,
        };
    };
}

// eslint-disable-next-line @typescript-eslint/ban-types
export default connect<StateProps, {}, OwnProps, GlobalState>(makeMapStateToProps)(SearchResults);
