// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {useHistory} from 'react-router-dom';
import {FormattedMessage, useIntl} from 'react-intl';

import NoResultsIndicator from 'components/no_results_indicator';
import Button from 'components/threading/common/button';
import VirtualizedThreadList from 'components/threading/global_threads/thread_list/virtualized_thread_list';

import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserThread} from '@mattermost/types/threads';
import type {UserProfile} from '@mattermost/types/users';

import Header from './header';
import BugSearchIllustration from './channel_search_illustration';

import type {FetchThreadOptions} from 'mattermost-redux/actions/threads';

import './channel_threads_rhs.scss';

export type Props = {
    all: Array<UserThread['id']>;
    canGoBack: boolean;
    channel: Channel;
    created: Array<UserThread['id']>;
    currentTeamId: Team['id'];
    currentTeamName: Team['name'];
    currentUserId: UserProfile['id'];
    following: Array<UserThread['id']>;
    total: number;
    isSideBarExpanded: boolean;

    actions: {
        closeRightHandSide: () => void;
        goBack: () => void;
        selectPostFromRightHandSideSearchByPostId: (id: string) => void;
        getThreadsForChannel: (id: Channel['id'], options?: FetchThreadOptions) => any;
        getThreadsCountsForChannel: (id: Channel['id']) => any;
        toggleRhsExpanded: () => void;
    };
}

enum Tabs {
    ALL,
    FOLLOWING,
    CREATED,
}

function ChannelThreads({
    actions,
    all,
    canGoBack,
    channel,
    created,
    currentTeamId,
    currentTeamName,
    currentUserId,
    following,
    total,
    isSideBarExpanded,
}: Props) {
    const {formatMessage} = useIntl();
    const history = useHistory();
    const [selected, setSelected] = useState(Tabs.ALL);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let after = '';
        if (all.length) {
            after = all[0];
        }
        actions.getThreadsCountsForChannel(channel.id);
        actions.getThreadsForChannel(channel.id, {after, perPage: 5});
    }, [channel.id]);

    const handleLoadMoreItems = useCallback(async (startIndex) => {
        setIsLoading(true);
        const before = all[startIndex - 1];
        await actions.getThreadsForChannel(channel.id, {before, perPage: 5});
        setIsLoading(false);
    }, [currentTeamId, all]);

    const select = useCallback((threadId?: UserThread['id']) => {
        if (threadId) {
            actions.selectPostFromRightHandSideSearchByPostId(threadId);
        }
    }, []);

    const goToInChannel = useCallback((threadId: UserThread['id']) => {
        return history.push(`/${currentTeamName}/pl/${threadId}`);
    }, [currentTeamName]);

    const handleAll = useCallback(() => {
        setSelected(Tabs.ALL);
    }, []);

    const handleFollowed = useCallback(() => {
        setSelected(Tabs.FOLLOWING);
    }, []);

    const handleCreated = useCallback(() => {
        setSelected(Tabs.CREATED);
    }, []);

    const routing = useMemo(() => {
        return {
            select,
            goToInChannel,
            currentTeamId,
            currentUserId,
            params: {
                team: currentTeamName,
            },
        };
    }, [select, goToInChannel, currentTeamId]);

    const ids = useMemo(() => {
        if (selected === Tabs.FOLLOWING) {
            return following;
        }
        if (selected === Tabs.CREATED) {
            return created;
        }

        return all;
    }, [
        selected,
        all,
        following,
        created,
    ]);

    const noResultsSubtitle = useMemo(() => {
        if (selected === Tabs.FOLLOWING) {
            return formatMessage({
                id: 'channel_threads.noResults.following',
                defaultMessage: 'You don’t follow any threads in this channel.',
            });
        }
        if (selected === Tabs.CREATED) {
            return formatMessage({
                id: 'channel_threads.noResults.created',
                defaultMessage: 'You don’t have any threads that you created in this channel.',
            });
        }
        return formatMessage({
            id: 'channel_threads.noResults.all',
            defaultMessage: 'There are no threads in this channel.',
        });
    }, [selected]);

    return (
        <div
            id='rhsContainer'
            className='sidebar-right__body ChannelThreadList'
        >
            <Header
                canGoBack={canGoBack}
                channel={channel}
                goBack={actions.goBack}
                isExpanded={isSideBarExpanded}
                onClose={actions.closeRightHandSide}
                toggleRhsExpanded={actions.toggleRhsExpanded}
            />
            <div className='tab-buttons'>
                <div className='tab-button-wrapper'>
                    <Button
                        className='Button___large Margined'
                        isActive={selected === Tabs.ALL}
                        onClick={handleAll}
                    >
                        <FormattedMessage
                            id='channel_threads.filters.all'
                            defaultMessage='All'
                        />
                    </Button>
                </div>
                <div className='tab-button-wrapper'>
                    <Button
                        className='Button___large Margined'
                        isActive={selected === Tabs.FOLLOWING}
                        onClick={handleFollowed}
                    >
                        <FormattedMessage
                            id='channel_threads.filters.following'
                            defaultMessage='Following'
                        />
                    </Button>
                </div>
                <div className='tab-button-wrapper'>
                    <Button
                        className='Button___large Margined'
                        isActive={selected === Tabs.CREATED}
                        onClick={handleCreated}
                    >
                        <FormattedMessage
                            id='channel_threads.filters.createdByMe'
                            defaultMessage='Created by me'
                        />
                    </Button>
                </div>
            </div>
            <div className='channel-threads'>
                {ids.length ? (
                    <VirtualizedThreadList
                        ids={ids}
                        total={total}
                        isLoading={isLoading}
                        loadMoreItems={handleLoadMoreItems}
                        routing={routing}
                    />
                ) : (
                    <NoResultsIndicator
                        expanded={true}
                        iconGraphic={BugSearchIllustration}
                        subtitle={noResultsSubtitle}
                        title={formatMessage({
                            id: 'channel_threads.noResults.title',
                            defaultMessage: 'No threads here',
                        })}
                    />
                )}
            </div>
        </div>
    );
}

export default memo(ChannelThreads);
