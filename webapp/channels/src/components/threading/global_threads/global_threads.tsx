// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import isEmpty from 'lodash/isEmpty';
import React, {memo, useCallback, useEffect, useState} from 'react';
import type {ReactNode} from 'react';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch, shallowEqual} from 'react-redux';
import {Link, useRouteMatch} from 'react-router-dom';

import {getThreadCounts, getThreadsForCurrentTeam} from 'mattermost-redux/actions/threads';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {
    getThreadOrderInCurrentTeam,
    getUnreadThreadOrderInCurrentTeam,
    getThreadCountsInCurrentTeam,
    getThread,
} from 'mattermost-redux/selectors/entities/threads';

import {clearLastUnreadChannel} from 'actions/global_actions';
import {loadProfilesForSidebar} from 'actions/user_actions';
import {selectLhsItem} from 'actions/views/lhs';
import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';
import {setSelectedThreadId} from 'actions/views/threads';
import {getSelectedThreadIdInCurrentTeam} from 'selectors/views/threads';
import {useGlobalState} from 'stores/hooks';
import LocalStorageStore from 'stores/local_storage_store';

import ChatIllustration from 'components/common/svg_images_components/chat_illustration';
import LoadingScreen from 'components/loading_screen';
import NoResultsIndicator from 'components/no_results_indicator';

import {PreviousViewedTypes} from 'utils/constants';
import {Mark, Measure, measureAndReport} from 'utils/performance_telemetry';

import type {GlobalState} from 'types/store/index';
import {LhsItemType, LhsPage} from 'types/store/lhs';

import ThreadList, {ThreadFilter, FILTER_STORAGE_KEY} from './thread_list';
import ThreadPane from './thread_pane';

import {useThreadRouting} from '../hooks';
import ThreadViewer from '../thread_viewer';

import './global_threads.scss';

const GlobalThreads = () => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const {url, params: {threadIdentifier}} = useRouteMatch<{threadIdentifier?: string}>();
    const [filter, setFilter] = useGlobalState(ThreadFilter.none, FILTER_STORAGE_KEY);
    const {currentTeamId, currentUserId, clear} = useThreadRouting();

    const counts = useSelector(getThreadCountsInCurrentTeam);
    const selectedThread = useSelector((state: GlobalState) => getThread(state, threadIdentifier));
    const selectedThreadId = useSelector(getSelectedThreadIdInCurrentTeam);
    const selectedPost = useSelector((state: GlobalState) => getPost(state, threadIdentifier!));
    const threadIds = useSelector((state: GlobalState) => getThreadOrderInCurrentTeam(state), shallowEqual);
    const unreadThreadIds = useSelector((state: GlobalState) => getUnreadThreadOrderInCurrentTeam(state), shallowEqual);
    const numUnread = counts?.total_unread_threads || 0;

    useEffect(() => {
        dispatch(suppressRHS);
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Threads));
        dispatch(clearLastUnreadChannel);
        loadProfilesForSidebar();

        const penultimateType = LocalStorageStore.getPreviousViewedType(currentUserId, currentTeamId);

        if (penultimateType !== PreviousViewedTypes.THREADS) {
            LocalStorageStore.setPenultimateViewedType(currentUserId, currentTeamId, penultimateType);
            LocalStorageStore.setPreviousViewedType(currentUserId, currentTeamId, PreviousViewedTypes.THREADS);
        }

        // unsuppresses RHS on navigating away (unmount)
        return () => {
            dispatch(unsuppressRHS);
        };
    }, []);

    useEffect(() => {
        dispatch(getThreadCounts(currentUserId, currentTeamId));
    }, [currentTeamId, currentUserId]);

    useEffect(() => {
        if (!selectedThreadId || selectedThreadId !== threadIdentifier) {
            dispatch(setSelectedThreadId(currentTeamId, selectedThread?.id));
        }
    }, [currentTeamId, selectedThreadId, threadIdentifier]);

    const isEmptyList = isEmpty(threadIds) && isEmpty(unreadThreadIds);

    const [isLoading, setLoading] = useState(isEmptyList);

    const shouldLoadThreads = isEmpty(threadIds);
    const shouldLoadUnreadThreads = isEmpty(unreadThreadIds);

    useEffect(() => {
        const promises = [];

        // this is needed to jump start threads fetching
        if (shouldLoadThreads) {
            promises.push(dispatch(getThreadsForCurrentTeam({unread: false})));
        }

        if (filter === ThreadFilter.unread && shouldLoadUnreadThreads) {
            promises.push(dispatch(getThreadsForCurrentTeam({unread: true})));
        }

        Promise.all(promises).then(() => {
            setLoading(false);
        });
    }, [filter, threadIds, unreadThreadIds]);

    useEffect(() => {
        if (!isLoading) {
            measureAndReport({
                name: Measure.GlobalThreadsLoad,
                startMark: Mark.GlobalThreadsLinkClicked,
                canFail: true,
            });
            performance.clearMarks(Mark.GlobalThreadsLinkClicked);
        }
    }, [isLoading]);

    useEffect(() => {
        if (!selectedThread && !selectedPost && !isLoading) {
            clear();
        }
    }, [currentTeamId, selectedThread, selectedPost, isLoading, counts, filter]);

    // cleanup on unmount
    useEffect(() => {
        return () => {
            dispatch(setSelectedThreadId(currentTeamId, ''));
        };
    }, []);

    const handleSelectUnread = useCallback(() => {
        setFilter(ThreadFilter.unread);
    }, []);

    return (
        <div
            id='app-content'
            className={classNames('GlobalThreads app__content', {'thread-selected': Boolean(selectedThread)})}
        >
            {isLoading || isEmptyList ? (
                <div className='no-results__holder'>
                    {isLoading ? (
                        <LoadingScreen/>
                    ) : (
                        <NoResultsIndicator
                            expanded={true}
                            iconGraphic={ChatIllustration}
                            title={formatMessage({
                                id: 'globalThreads.noThreads.title',
                                defaultMessage: 'No followed threads yet',
                            })}
                            subtitle={formatMessage({
                                id: 'globalThreads.noThreads.subtitle',
                                defaultMessage: 'Any threads you are mentioned in or have participated in will show here along with any threads you have followed.',
                            })}
                        />
                    )}
                </div>
            ) : (
                <>
                    <ThreadList
                        currentFilter={filter}
                        setFilter={setFilter}
                        someUnread={Boolean(numUnread)}
                        selectedThreadId={threadIdentifier}
                        ids={threadIds}
                        unreadIds={unreadThreadIds}
                    />
                    {selectedThread && selectedPost ? (
                        <ThreadPane
                            thread={selectedThread}
                        >
                            <ThreadViewer
                                rootPostId={selectedThread.id}
                                useRelativeTimestamp={true}
                                isThreadView={true}
                            />
                        </ThreadPane>
                    ) : (
                        <NoResultsIndicator
                            expanded={true}
                            iconGraphic={ChatIllustration}
                            title={formatMessage({
                                id: 'globalThreads.threadPane.unselectedTitle',
                                defaultMessage: '{numUnread, plural, =0 {Looks like you’re all caught up} other {Catch up on your threads}}',
                            }, {numUnread})}
                            subtitle={formatMessage<ReactNode>({
                                id: 'globalThreads.threadPane.unreadMessageLink',
                                defaultMessage: 'You have {numUnread, plural, =0 {no unread threads} =1 {<link>{numUnread} thread</link>} other {<link>{numUnread} threads</link>}} {numUnread, plural, =0 {} other {with unread messages}}',
                            }, {
                                numUnread,
                                link: (chunks) => (
                                    <Link
                                        key='single'
                                        to={`${url}/${unreadThreadIds[0]}`}
                                        onClick={handleSelectUnread}
                                    >
                                        {chunks}
                                    </Link>
                                ),
                            })}
                        />
                    )}
                </>
            )}
        </div>
    );
};

export default memo(GlobalThreads);
