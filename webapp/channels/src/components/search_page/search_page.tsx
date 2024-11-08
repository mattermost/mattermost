// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import { Badge } from '@mui/base';
import React, { memo, useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { type match, useHistory, useRouteMatch } from 'react-router-dom';

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

type SearchBookmark = {
    title: string;
    terms: string;
    search_type: string;
    results: Post[];
    fileResults: Post[];
}

function SearchPage() {
    const dispatch = useDispatch();
    const [searchBookmark, setSearchBookmark] = useState<SearchBookmark | null>(null);

    const match: match<{ team: string, searchId: string }> = useRouteMatch();

    const currentTeam = useSelector(getCurrentTeam);

    useEffect(() => {
        Client4.getSearchBookmark(currentTeam?.id || '', match.params.searchId).then(async (data) => {
            await dispatch(searchPostsWithParams(currentTeam?.id || '', { terms: data.terms, is_or_search: false, include_deleted_channels: false, page: 0, per_page: 20 }));
            setSearchBookmark(data);
        });
    }, [dispatch, currentTeam?.id, match.params.searchId]);

    if (searchBookmark == null) {
        return null
    }

    var searchResults = Object.values(searchBookmark?.results) || [];
    searchResults.sort((a, b) => {
        return a.create_at - b.create_at;
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
            <div className='SearchPage__results'>
                {contentItems}
            </div>
        </div>
    );
}

export default memo(SearchPage);
