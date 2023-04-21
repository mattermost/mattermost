// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {useHistory} from 'react-router-dom';
import {FormattedMessage, useIntl} from 'react-intl';

import LoadingScreen from 'components/loading_screen';
import NoResultsIndicator from 'components/no_results_indicator';
import Button from 'components/threading/common/button';
import VirtualizedThreadList from 'components/threading/global_threads/thread_list/virtualized_thread_list';
import Constants from 'utils/constants';

import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserThread} from '@mattermost/types/threads';
import type {UserProfile} from '@mattermost/types/users';
import type {FetchChannelThreadOptions} from '@mattermost/types/client4';

import Header from './header';
import ThreadsIllustration from './threads_illustration';

import './channel_threads_rhs.scss';

export enum Tabs {
    ALL,
    FOLLOWING,
    USER,
}

export type Props = {
    all: Array<UserThread['id']>;
    canGoBack: boolean;
    channel: Channel;
    created: Array<UserThread['id']>;
    currentTeamId: Team['id'];
    currentTeamName: Team['name'];
    currentUserId: UserProfile['id'];
    following: Array<UserThread['id']>;
    isCollapsedThreadsEnabled: boolean;
    isSideBarExpanded: boolean;
    selected: Tabs;
    total: number;
    totalFollowing: number;
    totalUser: number;

    actions: {
        closeRightHandSide: () => void;
        getThreadsForChannel: (id: Channel['id'], filter: Tabs, options?: FetchChannelThreadOptions) => void;
        goBack: () => void;
        selectPostFromRightHandSideSearchByPostId: (id: string) => void;
        setSelected: (tab: Tabs) => void;
        toggleRhsExpanded: () => void;
    };
}

const loadingStyle = {
    display: 'grid',
    placeContent: 'center',
    flex: '1',
};

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
    isCollapsedThreadsEnabled,
    isSideBarExpanded,
    selected,
    total,
    totalFollowing,
    totalUser,
}: Props) {
    const {formatMessage} = useIntl();
    const history = useHistory();
    const [isPaging, setIsPaging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    let ids = all;
    let totalThreads = total;
    let noResultsSubtitle = formatMessage({
        id: 'channel_threads.noResults.all',
        defaultMessage: 'There are no threads in this channel.',
    });
    if (selected === Tabs.FOLLOWING) {
        ids = following;
        totalThreads = totalFollowing;
        noResultsSubtitle = formatMessage({
            id: 'channel_threads.noResults.following',
            defaultMessage: 'You don\'t follow any threads in this channel.',
        });
    }
    if (selected === Tabs.USER) {
        ids = created;
        totalThreads = totalUser;
        noResultsSubtitle = formatMessage({
            id: 'channel_threads.noResults.created',
            defaultMessage: 'You don\'t have any threads that you created in this channel.',
        });
    }

    useEffect(() => {
        setIsLoading(true);
        const after = ids.length ? ids[0] : '';
        const fetchThreads = async () => {
            const options = {
                after,
                perPage: Constants.THREADS_PAGE_SIZE,
            };
            await actions.getThreadsForChannel(channel.id, selected, options);
            setIsLoading(false);
        };
        fetchThreads();

        // fetch threads when either
        //  - current channel changed,
        //  - selected tab changed,
        //  - total threads just went from 0 to a number
    }, [channel.id, selected, totalThreads > 0]);

    const handleLoadMoreItems = useCallback(async (startIndex) => {
        setIsPaging(true);
        const options = {
            before: ids[startIndex - 1],
            threadsOnly: true,
            perPage: Constants.THREADS_PAGE_SIZE,
        };
        await actions.getThreadsForChannel(channel.id, selected, options);
        setIsPaging(false);
    }, [channel.id, ids]);

    const select = useCallback((threadId?: UserThread['id']) => {
        if (threadId) {
            actions.selectPostFromRightHandSideSearchByPostId(threadId);
        }
    }, []);

    const goToInChannel = useCallback((threadId: UserThread['id']) => {
        return history.push(`/${currentTeamName}/pl/${threadId}`);
    }, [currentTeamName]);

    const makeHandleTab = useCallback((tab: Tabs) => () => {
        actions.setSelected(tab);
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
                        onClick={makeHandleTab(Tabs.ALL)}
                    >
                        <FormattedMessage
                            id='channel_threads.filters.all'
                            defaultMessage='All'
                        />
                    </Button>
                </div>
                {isCollapsedThreadsEnabled && (
                    <div className='tab-button-wrapper'>
                        <Button
                            className='Button___large Margined'
                            isActive={selected === Tabs.FOLLOWING}
                            onClick={makeHandleTab(Tabs.FOLLOWING)}
                        >
                            <FormattedMessage
                                id='channel_threads.filters.following'
                                defaultMessage='Following'
                            />
                        </Button>
                    </div>
                )}
                <div className='tab-button-wrapper'>
                    <Button
                        className='Button___large Margined'
                        isActive={selected === Tabs.USER}
                        onClick={makeHandleTab(Tabs.USER)}
                    >
                        <FormattedMessage
                            id='channel_threads.filters.createdByMe'
                            defaultMessage='Created by me'
                        />
                    </Button>
                </div>
            </div>
            <div className='channel-threads'>
                {ids.length === 0 && (
                    <>
                        {isLoading ? (
                            <LoadingScreen style={loadingStyle}/>
                        ) : (
                            <NoResultsIndicator
                                expanded={true}
                                iconGraphic={ThreadsIllustration}
                                subtitle={noResultsSubtitle}
                                subtitleClassName='thread-no-results-subtitle'
                                title={formatMessage({
                                    id: 'channel_threads.noResults.title',
                                    defaultMessage: 'No threads here',
                                })}
                                titleClassName='thread-no-results-title'
                            />
                        )}
                    </>
                )}

                {ids.length > 0 && (
                    <VirtualizedThreadList
                        key={`${selected}-${Math.min(totalThreads, Constants.THREADS_PAGE_SIZE)}`}
                        ids={ids}
                        isLoading={isPaging}
                        loadMoreItems={handleLoadMoreItems}
                        routing={routing}
                        total={totalThreads}
                    />
                )}
            </div>
        </div>
    );
}

export default memo(ChannelThreads);
