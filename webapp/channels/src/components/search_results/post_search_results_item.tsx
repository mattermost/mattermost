// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {isChannelAutotranslated} from 'mattermost-redux/selectors/entities/channels';

import PostComponent from 'components/post';

import {Locations} from 'utils/constants';
import {isPagePost} from 'utils/page_utils';

import type {GlobalState} from 'types/store';

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
    const isPage = isPagePost(props.post);
    const autotranslated = useSelector((state: GlobalState) => isChannelAutotranslated(state, props.post.channel_id));
    return (
        <div
            className='search-item__container'
            data-testid='search-item-container'
        >
            {isPage && (
                <div className='search-item__page-indicator'>
                    <i className='icon-file-document-outline'/>
                    <span>{'Wiki Page'}</span>
                </div>
            )}
            <PostComponent
                post={props.post}
                matches={props.matches}
                term={(!props.isFlaggedPosts && !props.isPinnedPosts && !props.isMentionSearch) ? props.searchTerm : ''}
                isMentionSearch={props.isMentionSearch}
                a11yIndex={props.a11yIndex}
                location={Locations.SEARCH}
                isChannelAutotranslated={autotranslated}
            />
        </div>
    );
}
