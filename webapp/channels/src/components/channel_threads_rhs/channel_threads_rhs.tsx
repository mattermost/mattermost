// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {useHistory} from 'react-router-dom';

import VirtualizedThreadList from 'components/threading/global_threads/thread_list/virtualized_thread_list';
import Button from 'components/threading/common/button';

import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserThread} from '@mattermost/types/threads';
import type {UserProfile} from '@mattermost/types/users';

import Header from './header';

import type {FetchThreadOptions} from 'mattermost-redux/actions/threads';

import './channel_threads_rhs.scss';
import {FormattedMessage} from 'react-intl';

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

    actions: {
        closeRightHandSide: () => void;
        goBack: () => void;
        selectPostFromRightHandSideSearchByPostId: (id: string) => void;
        getThreadsForChannel: (id: Channel['id'], options?: FetchThreadOptions) => any;
        getThreadsCountsForChannel: (id: Channel['id']) => any;
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
}: Props) {
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
        if (selected === Tabs.ALL) {
            return all;
        }
        if (selected === Tabs.FOLLOWING) {
            return following;
        }
        if (selected === Tabs.CREATED) {
            return created;
        }

        return [];
    }, [
        selected,
        all,
        following,
        created,
    ]);

    return (
        <div
            id='rhsContainer'
            className='sidebar-right__body ChannelThreadList'
        >
            <Header
                channel={channel}
                canGoBack={canGoBack}
                onClose={actions.closeRightHandSide}
                goBack={actions.goBack}
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
                <VirtualizedThreadList
                    ids={ids}
                    total={total}
                    isLoading={isLoading}
                    loadMoreItems={handleLoadMoreItems}
                    routing={routing}
                />
            </div>
        </div>
    );
}

export default memo(ChannelThreads);
