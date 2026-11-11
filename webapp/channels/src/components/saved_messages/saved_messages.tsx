// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useMemo} from 'react';
import {defineMessage, FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getDateForDateLine, isDateLine, makeAddDateSeparatorsForSearchResults} from 'mattermost-redux/utils/post_list';

import {getMoreFlaggedPosts} from 'actions/views/rhs';
import {getIsSearchingFlaggedPost, getSearchTeam} from 'selectors/rhs';

import PagedList from 'components/common/paged_list';
import NoResultsIndicator from 'components/no_results_indicator/no_results_indicator';
import {NoResultsVariant} from 'components/no_results_indicator/types';
import DateSeparator from 'components/post_view/date_separator';
import {getSearchPopoutTitle} from 'components/rhs_search_popout/title';
import PostSearchResultsItem from 'components/search_results/post_search_results_item';
import SearchResultsHeader from 'components/search_results_header';
import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

import {DataSearchTypes, RHSStates} from 'utils/constants';
import {popoutRhsSearch} from 'utils/popouts/popout_windows';

import type {GlobalState} from 'types/store';

const title = defineMessage({
    id: 'search_header.title3',
    defaultMessage: 'Saved messages',
});

export const getSavedPosts = createSelector(
    'getSavedPosts',
    (state: GlobalState) => state.entities.search.flagged,
    (state: GlobalState) => state.entities.posts.posts,
    (postIds, posts) => postIds.
        map((id) => posts[id]).
        filter((post): post is Post => Boolean(post)).
        sort((a, b) => b.create_at - a.create_at),
);

type Props = {
    isOpened?: boolean;
    isSideBarExpanded?: boolean;
};

const SavedMessages = ({isOpened = true, isSideBarExpanded = false}: Props) => {
    const intl = useIntl();
    const dispatch = useDispatch();
    const addDateSeparators = useMemo(() => makeAddDateSeparatorsForSearchResults(), []);

    const items = useSelector((state: GlobalState) => addDateSeparators(state, getSavedPosts(state)));
    const isLoading = useSelector(getIsSearchingFlaggedPost) || !isOpened;
    const {isEnd} = useSelector((state: GlobalState) => state.entities.search.flaggedPaging);
    const isLoadingMore = useSelector((state: GlobalState) => state.entities.search.isSearchGettingMore);
    const currentTeamName = useSelector(getCurrentTeam)?.name ?? '';
    const searchTeamId = useSelector(getSearchTeam);

    const formattedTitle = intl.formatMessage(title);
    const noResults = items.length === 0;
    const hasMore = !isLoading && !isEnd;

    const loadMore = useCallback(() => {
        dispatch(getMoreFlaggedPosts());
    }, [dispatch]);

    const newWindowHandler = useCallback(() => {
        popoutRhsSearch(
            intl.formatMessage(getSearchPopoutTitle(RHSStates.FLAG), {serverName: '{serverName}', channelName: '{channelName}', searchTerms: ''}),
            currentTeamName,
            '',
            RHSStates.FLAG,
            DataSearchTypes.MESSAGES_SEARCH_TYPE,
            undefined,
            searchTeamId,
        );
    }, [intl, currentTeamName, searchTeamId]);

    let content;
    if (isLoading) {
        content = (
            <div className='sidebar--right__subheader a11y__section'>
                <div className='sidebar--right__loading'>
                    <LoadingWrapper text={defineMessage({id: 'search_header.loading', defaultMessage: 'Searching...'})}/>
                </div>
            </div>
        );
    } else if (noResults && isEnd) {
        content = (
            <div
                className={classNames('sidebar--right__subheader a11y__section', {'sidebar-expanded': isSideBarExpanded})}
                aria-live='polite'
            >
                <NoResultsIndicator
                    style={{padding: '48px'}}
                    variant={NoResultsVariant.FlaggedPosts}
                    subtitleValues={{
                        buttonText: (
                            <strong>
                                <FormattedMessage
                                    id='flag_post.flag'
                                    defaultMessage='Save Message'
                                />
                            </strong>
                        ),
                    }}
                />
            </div>
        );
    } else {
        content = items.map((item, index) => {
            if (typeof item === 'string' && isDateLine(item)) {
                const date = getDateForDateLine(item);
                return (
                    <DateSeparator
                        key={date}
                        date={date}
                    />
                );
            }

            const post = item as Post;
            return (
                <PostSearchResultsItem
                    key={post.id}
                    post={post}
                    matches={[]}
                    searchTerm=''
                    isFlaggedPosts={true}
                    isMentionSearch={false}
                    isPinnedPosts={false}
                    a11yIndex={index}
                />
            );
        });
    }

    return (
        <div
            id='searchContainer'
            className='SearchResults sidebar-right__body'
        >
            <SearchResultsHeader newWindowHandler={newWindowHandler}>
                <h2 id='rhsPanelTitle'>
                    {formattedTitle}
                </h2>
            </SearchResultsHeader>
            <PagedList
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                onLoadMore={loadMore}
                loadUntilFull={true}
            >
                <div
                    id='search-items-container'
                    className={classNames('search-items-container post-list__table a11y__region', {'no-results': noResults && isEnd})}
                    data-a11y-sort-order='3'
                    data-a11y-focus-child={true}
                    data-a11y-loop-navigation={false}
                    aria-label={intl.formatMessage({
                        id: 'accessibility.sections.rhs',
                        defaultMessage: '{regionTitle} complementary region',
                    }, {
                        regionTitle: formattedTitle,
                    })}
                >
                    {content}
                </div>
            </PagedList>
        </div>
    );
};

export default SavedMessages;
