// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, { memo, useRef, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { type match, useHistory, useRouteMatch, useLocation } from 'react-router-dom';
import Scrollbars from 'react-custom-scrollbars';

import type { FileSearchResultItem as FileSearchResultItemType } from '@mattermost/types/files';
import type { Post } from '@mattermost/types/posts';
import { Client4 } from 'mattermost-redux/client';
import { searchPostsWithParams } from 'mattermost-redux/actions/search';

import { getCurrentTeamId, getCurrentTeam } from 'mattermost-redux/selectors/entities/teams';
import { DataSearchTypes } from 'utils/constants';

import Header from 'components/widgets/header';
import PostSearchResultsItem from 'components/search_results/post_search_results_item';
import FileSearchResultItem from 'components/file_search_results';

import './search_page.scss';

const GET_MORE_BUFFER = 30;

type SearchBookmark = {
    title: string;
    terms: string;
    search_type: string;
    results: Record<string, Post>;
    fileResults: Record<string, Post>;
}

const renderView = (props: Record<string, unknown>): JSX.Element => (
    <div
        {...props}
        className='scrollbar--view'
    />
);

const renderThumbHorizontal = (props: Record<string, unknown>): JSX.Element => (
    <div
        {...props}
        className='scrollbar--horizontal scrollbar--thumb--RHS'
    />
);

const renderThumbVertical = (props: Record<string, unknown>): JSX.Element => (
    <div
        {...props}
        className='scrollbar--vertical scrollbar--thumb--RHS'
    />
);

const renderTrackVertical = (props: Record<string, unknown>): JSX.Element => (
    <div
        {...props}
        className='scrollbar--vertical--RHS'
    />
);

function useQuery() {
    const { search } = useLocation();

    return React.useMemo(() => new URLSearchParams(search), [search]);
}

function SearchPage() {
    const scrollbars = useRef<Scrollbars | null>(null);
    const [currentPage, setCurrentPage] = useState(0)
    const dispatch = useDispatch();
    const [searchBookmark, setSearchBookmark] = useState<SearchBookmark | null>(null);

    const match: match<{ team: string, searchId: string }> = useRouteMatch();
    const params = useQuery()

    const search_type = params.get('search_type') || '';
    const terms = params.get('terms') || '';

    const currentTeam = useSelector(getCurrentTeam);

    useEffect(() => {
        setCurrentPage(0)
        if (match.params.searchId !== undefined) {
            Client4.getSearchBookmark(currentTeam?.id || '', match.params.searchId, { is_or_search: false, include_deleted_channels: false, page: currentPage, per_page: 20 }).then(async (data) => {
                await dispatch(searchPostsWithParams(currentTeam?.id || '', { terms: data.terms, is_or_search: false, include_deleted_channels: false, page: currentPage, per_page: 20 }));
                setSearchBookmark(data);
            });
        } else {
            Client4.searchPostsWithParams(currentTeam?.id || '', { terms: terms, is_or_search: false, include_deleted_channels: false, page: currentPage, per_page: 20 }).then(async (data) => {
                await dispatch(searchPostsWithParams(currentTeam?.id || '', { terms: terms, is_or_search: false, include_deleted_channels: false, page: currentPage, per_page: 20 }));
                setSearchBookmark({
                    title: "Shared search",
                    terms,
                    search_type,
                    results: data.posts,
                    fileResults: {},
                });
            });
        }
    }, [dispatch, currentTeam?.id, match.params.searchId]);

    const loadMoreFiles = () => []
    const loadMorePosts = () => {
        if (match.params.searchId !== undefined) {
            Client4.getSearchBookmark(currentTeam?.id || '', match.params.searchId, { is_or_search: false, include_deleted_channels: false, page: currentPage + 1, per_page: 20 }).then(async (data) => {
                await dispatch(searchPostsWithParams(currentTeam?.id || '', { terms: data.terms, is_or_search: false, include_deleted_channels: false, page: currentPage + 1, per_page: 20 }));
                setCurrentPage(currentPage + 1)
                data.results = Object.assign({}, data.results, (searchBookmark?.results || {}))
                setSearchBookmark(data);
            });
        } else {
            Client4.searchPostsWithParams(currentTeam?.id || '', { terms: terms, is_or_search: false, include_deleted_channels: false, page: currentPage, per_page: 20 }).then(async (data) => {
                await dispatch(searchPostsWithParams(currentTeam?.id || '', { terms: terms, is_or_search: false, include_deleted_channels: false, page: currentPage, per_page: 20 }));
                setSearchBookmark({
                    title: "Shared search",
                    terms,
                    search_type,
                    results: Object.assign({}, data.posts, (searchBookmark?.results || {})),
                    fileResults: {},
                });
            });
        }
    }

    if (searchBookmark == null) {
        return null
    }

    var searchResults = Object.values(searchBookmark?.results) || [];
    searchResults.sort((a, b) => {
        return b.create_at - a.create_at;
    })

    const contentItems = searchResults.map((item: Post | FileSearchResultItemType, index: number) => {
        if (item === undefined) {
            return null;
        }
        if (searchBookmark?.search_type === DataSearchTypes.MESSAGES_SEARCH_TYPE) {
            return (
                <PostSearchResultsItem
                    key={item.id}
                    post={item as Post}
                    matches={[]}
                    searchTerm={searchBookmark?.terms || ''}
                    isFlaggedPosts={false}
                    isMentionSearch={false}
                    isPinnedPosts={false}
                    a11yIndex={index}
                />
            );
        }
        return (
            <FileSearchResultItem
                key={item.id}
                channelId={item.channel_id}
                fileInfo={item as FileSearchResultItemType}
                teamName={currentTeam?.name || ''}
                pluginMenuItems={[]}
            />
        );
    });

    const handleScroll = (): void => {
        const scrollHeight = scrollbars.current?.getScrollHeight() || 0;
        const scrollTop = scrollbars.current?.getScrollTop() || 0;
        const clientHeight = scrollbars.current?.getClientHeight() || 0;
        if ((scrollTop + clientHeight + GET_MORE_BUFFER) >= scrollHeight) {
            if (searchBookmark.search_type === DataSearchTypes.FILES_SEARCH_TYPE) {
                loadMoreFiles();
            } else {
                loadMorePosts();
            }
        }
    };

    return (
        <div
            id='app-content'
            className='SearchPage app__content'
        >
            <Header
                level={2}
                className='SearchPage__header'
                heading={searchBookmark?.title}
                subtitle={searchBookmark?.terms}
            />
            <Scrollbars
                ref={scrollbars}
                autoHide={true}
                autoHideTimeout={500}
                autoHideDuration={500}
                renderTrackVertical={renderTrackVertical}
                renderThumbHorizontal={renderThumbHorizontal}
                renderThumbVertical={renderThumbVertical}
                renderView={renderView}
                onScroll={handleScroll}
            >
                <div className='SearchPage__results'>
                    {contentItems}
                </div>
            </Scrollbars>
        </div>
    );
}

export default memo(SearchPage);
