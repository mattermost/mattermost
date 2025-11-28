// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useRef} from 'react';
import {useIntl, defineMessage} from 'react-intl';

import type {Post} from '@mattermost/types/posts';

import {debounce} from 'mattermost-redux/actions/helpers';
import {isDateLine, getDateForDateLine} from 'mattermost-redux/utils/post_list';

import Scrollbars from 'components/common/scrollbars';
import NoResultsIndicator from 'components/no_results_indicator/no_results_indicator';
import {NoResultsVariant} from 'components/no_results_indicator/types';
import DateSeparator from 'components/post_view/date_separator';
import PostSearchResultsItem from 'components/search_results/post_search_results_item';
import SearchResultsHeader from 'components/search_results_header';
import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

import type {Props} from './types';

import './flagged_posts_panel.scss';

const GET_MORE_BUFFER = 30;

const FlaggedPostsPanel: React.FC<Props> = ({
    posts,
    isLoading,
    isLoadingMore,
    isEnd,
    actions,
}) => {
    const scrollbars = useRef<HTMLDivElement>(null);
    const intl = useIntl();

    const loadMore = useCallback(
        debounce(
            () => {
                actions.getMoreFlaggedPosts();
            },
            100,
            false,
            () => {},
        ),
        [actions.getMoreFlaggedPosts],
    );

    const handleScroll = useCallback((): void => {
        if (isLoadingMore || isEnd) {
            return;
        }

        const scrollHeight = scrollbars.current?.scrollHeight || 0;
        const scrollTop = scrollbars.current?.scrollTop || 0;
        const clientHeight = scrollbars.current?.clientHeight || 0;

        if ((scrollTop + clientHeight + GET_MORE_BUFFER) >= scrollHeight) {
            loadMore();
        }
    }, [isLoadingMore, isEnd, loadMore]);

    const noResults = !posts || posts.length === 0;

    const titleDescriptor = defineMessage({
        id: 'search_header.title3',
        defaultMessage: 'Saved messages',
    });

    const formattedTitle = intl.formatMessage(titleDescriptor);

    let content: React.ReactNode;

    if (isLoading) {
        content = (
            <div className='sidebar--right__subheader a11y__section'>
                <div className='sidebar--right__loading'>
                    <LoadingWrapper
                        text={defineMessage({
                            id: 'search_header.loading',
                            defaultMessage: 'Searching',
                        })}
                    />
                </div>
            </div>
        );
    } else if (noResults) {
        content = (
            <div className='sidebar--right__subheader a11y__section'>
                <NoResultsIndicator
                    style={{padding: '48px'}}
                    variant={NoResultsVariant.FlaggedPosts}
                    subtitleValues={{
                        buttonText: (
                            <strong>
                                {intl.formatMessage({
                                    id: 'flag_post.flag',
                                    defaultMessage: 'Save Message',
                                })}
                            </strong>
                        ),
                    }}
                />
            </div>
        );
    } else {
        content = (
            <>
                {posts.map((item: Post | string, index: number) => {
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
                            isMentionSearch={false}
                            isPinnedPosts={false}
                            a11yIndex={index}
                        />
                    );
                })}
                {isLoadingMore && (
                    <div className='loading-screen'>
                        <div className='loading__content'>
                            <div className='round round-1'/>
                            <div className='round round-2'/>
                            <div className='round round-3'/>
                        </div>
                    </div>
                )}
            </>
        );
    }

    return (
        <div
            id='flaggedPostsPanel'
            className='FlaggedPostsPanel sidebar-right__body'
        >
            <SearchResultsHeader>
                <h2 id='rhsPanelTitle'>
                    {formattedTitle}
                </h2>
            </SearchResultsHeader>
            <Scrollbars
                ref={scrollbars}
                color='--center-channel-color-rgb'
                onScroll={handleScroll}
            >
                <div
                    id='flagged-posts-container'
                    className='search-items-container post-list__table a11y__region'
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
            </Scrollbars>
        </div>
    );
};

export default React.memo(FlaggedPostsPanel);
