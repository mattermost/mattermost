// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect} from 'react';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';
import {Link, useRouteMatch, useLocation, matchPath} from 'react-router-dom';

import {getThreadCounts} from 'mattermost-redux/actions/threads';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getThreadCountsInCurrentTeam} from 'mattermost-redux/selectors/entities/threads';

import {closeRightHandSide} from 'actions/views/rhs';
import {getIsRhsOpen, getRhsState} from 'selectors/rhs';

import ChannelMentionBadge from 'components/sidebar/sidebar_channel/channel_mention_badge';

import {RHSStates} from 'utils/constants';
import {Mark} from 'utils/performance_telemetry';

import ThreadsIcon from './threads_icon';

import {useThreadRouting} from '../hooks';

import './global_threads_link.scss';

const GlobalThreadsLink = () => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const isFeatureEnabled = useSelector(isCollapsedThreadsEnabled);

    const {url} = useRouteMatch();
    const {pathname} = useLocation();
    const inGlobalThreads = matchPath(pathname, {path: '/:team/threads/:threadIdentifier?'}) != null;
    const {currentTeamId, currentUserId} = useThreadRouting();

    const counts = useSelector(getThreadCountsInCurrentTeam);
    const someUnreadThreads = counts?.total_unread_threads;
    const rhsOpen = useSelector(getIsRhsOpen);
    const rhsState = useSelector(getRhsState);
    const openThreads = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();

        performance.mark(Mark.GlobalThreadsLinkClicked);

        if (rhsOpen && rhsState === RHSStates.EDIT_HISTORY) {
            dispatch(closeRightHandSide());
        }
    }, [rhsOpen, rhsState]);

    useEffect(() => {
        // load counts if necessary
        if (isFeatureEnabled) {
            dispatch(getThreadCounts(currentUserId, currentTeamId));
        }
    }, [currentUserId, currentTeamId, isFeatureEnabled]);

    if (!isFeatureEnabled) {
        // hide link if feature disabled
        return null;
    }

    return (
        <ul className='SidebarGlobalThreads NavGroupContent nav nav-pills__container'>
            <li
                id={'sidebar-threads-button'}
                className={classNames('SidebarChannel', {
                    active: inGlobalThreads,
                    unread: someUnreadThreads,
                })}
                tabIndex={-1}
            >
                <Link
                    onClick={openThreads}
                    to={`${url}/threads`}
                    id='sidebarItem_threads'
                    draggable='false'
                    className={classNames('SidebarLink sidebar-item', {
                        'unread-title': Boolean(someUnreadThreads),
                    })}
                    tabIndex={0}
                >
                    <span className='icon'>
                        <ThreadsIcon/>
                    </span>
                    <div className='SidebarChannelLinkLabel_wrapper'>
                        <span className='SidebarChannelLinkLabel sidebar-item__name'>
                            {formatMessage({id: 'globalThreads.sidebarLink', defaultMessage: 'Threads'})}
                        </span>
                    </div>
                    {counts?.total_unread_mentions > 0 && (
                        <ChannelMentionBadge
                            unreadMentions={counts.total_unread_mentions}
                            hasUrgent={Boolean(counts?.total_unread_urgent_mentions)}
                        />
                    )}
                </Link>
            </li>
        </ul>
    );
};

export default GlobalThreadsLink;
