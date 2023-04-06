// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useMemo, useState} from 'react';
import {useHistory} from 'react-router-dom';

import VirtualizedThreadList from 'components/threading/global_threads/thread_list/virtualized_thread_list';

import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserThread} from '@mattermost/types/threads';

import Header from './header';

import './channel_threads_rhs.scss';

export type Props = {
    channel: Channel;
    canGoBack: boolean;
    currentTeamId: Team['id'];
    currentTeamName: Team['name'];
    threads: Array<UserThread['id']>;
    total: number;

    actions: {
        closeRightHandSide: () => void;
        goBack: () => void;
        selectPostFromRightHandSideSearchByPostId: (id: string) => void;
        getThreadsInChannel: (id: Channel['id']) => Promise<void>;
    };
}

function ChannelThreads({
    actions,
    canGoBack,
    channel,
    currentTeamId,
    currentTeamName,
    threads,
    total,
}: Props) {
    const history = useHistory();
    const [isLoading, setIsLoading] = useState(false);

    useCallback(() => {
        const fetchThreads = async () => {
            if (!threads.length) {
                setIsLoading(true);
            }
            try {
                await actions.getThreadsInChannel(channel.id);
            } finally {
                setIsLoading(false);
            }
        };

        fetchThreads();
    }, [channel.id]);

    const handleLoadMoreItems = useCallback(async () => {
        return [];
    }, []);

    const select = useCallback((threadId?: UserThread['id']) => {
        if (threadId) {
            actions.selectPostFromRightHandSideSearchByPostId(threadId);
        }
    }, []);

    const goToInChannel = useCallback((threadId: UserThread['id']) => {
        return history.push(`/${currentTeamName}/pl/${threadId}`);
    }, [currentTeamName]);

    const routing = useMemo(() => {
        return {
            select,
            goToInChannel,
            currentTeamId,
        };
    }, [select, goToInChannel, currentTeamId]);

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
            <div className='channel-threads'>
                <VirtualizedThreadList
                    ids={threads}
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
