// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Post} from '@mattermost/types/posts';

import PostComponent from 'components/post';

import {Locations} from 'utils/constants';

type Props = {
    a11yIndex: number;
    isFlaggedPosts: boolean;
    isMentionSearch: boolean;
    isPinnedPosts: boolean;
    matches: string[];
    post: Post;
    searchTerm: string;
}

export default function PostSearchResultsItem(props: Props) {
    return (
        <div
            className='search-item__container'
            data-testid='search-item-container'
        >
            <PostComponent
                post={props.post}
                matches={props.matches}
                term={(!props.isFlaggedPosts && !props.isPinnedPosts && !props.isMentionSearch) ? props.searchTerm : ''}
                isMentionSearch={props.isMentionSearch}
                a11yIndex={props.a11yIndex}
                location={Locations.SEARCH}
            />
        </div>
    );
}
