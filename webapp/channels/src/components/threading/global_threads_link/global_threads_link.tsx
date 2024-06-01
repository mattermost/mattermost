// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect} from 'react';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';
import {Link, useRouteMatch, useLocation, matchPath} from 'react-router-dom';

import {PulsatingDot} from '@mattermost/components';

import {getThreadCounts} from 'mattermost-redux/actions/threads';
import {getInt, isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {
    getThreadCountsInCurrentTeam, getThreadsInCurrentTeam,
} from 'mattermost-redux/selectors/entities/threads';

import {trackEvent} from 'actions/telemetry_actions';
import {openModal} from 'actions/views/modals';
import {closeRightHandSide} from 'actions/views/rhs';
import {getIsRhsOpen, getRhsState} from 'selectors/rhs';
import {isAnyModalOpen} from 'selectors/views/modals';

import ChannelMentionBadge from 'components/sidebar/sidebar_channel/channel_mention_badge';
import CollapsedReplyThreadsModal
    from 'components/tours/crt_tour/collapsed_reply_threads_modal';
import CRTWelcomeTutorialTip
    from 'components/tours/crt_tour/crt_welcome_tutorial_tip';

import Constants, {
    CrtTutorialSteps,
    CrtTutorialTriggerSteps,
    ModalIdentifiers,
    Preferences,
    RHSStates,
} from 'utils/constants';
import {Mark} from 'utils/performance_telemetry';

import type {GlobalState} from 'types/store';

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
    const appHaveOpenModal = useSelector(isAnyModalOpen);
    const tipStep = useSelector((state: GlobalState) => getInt(state, Preferences.CRT_TUTORIAL_STEP, currentUserId, CrtTutorialSteps.WELCOME_POPOVER));
    const crtTutorialTrigger = useSelector((state: GlobalState) => getInt(state, Preferences.CRT_TUTORIAL_TRIGGERED, currentUserId, Constants.CrtTutorialTriggerSteps.START));
    const threads = useSelector(getThreadsInCurrentTeam);
    const showTutorialTip = crtTutorialTrigger === CrtTutorialTriggerSteps.STARTED && tipStep === CrtTutorialSteps.WELCOME_POPOVER && threads.length >= 1;
    const threadsCount = useSelector(getThreadCountsInCurrentTeam);
    const rhsOpen = useSelector(getIsRhsOpen);
    const rhsState = useSelector(getRhsState);
    const showTutorialTrigger = isFeatureEnabled && crtTutorialTrigger === Constants.CrtTutorialTriggerSteps.START && !appHaveOpenModal && Boolean(threadsCount) && threadsCount.total >= 1;
    const openThreads = useCallback((e) => {
        e.stopPropagation();

        trackEvent('crt', 'go_to_global_threads');

        performance.mark(Mark.GlobalThreadsLinkClicked);

        if (showTutorialTrigger) {
            dispatch(openModal({modalId: ModalIdentifiers.COLLAPSED_REPLY_THREADS_MODAL, dialogType: CollapsedReplyThreadsModal, dialogProps: {}}));
        }

        if (rhsOpen && rhsState === RHSStates.EDIT_HISTORY) {
            dispatch(closeRightHandSide());
        }
    }, [showTutorialTrigger, threadsCount, threads, rhsOpen, rhsState]);

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
                    {showTutorialTrigger && <PulsatingDot/>}
                </Link>
                {showTutorialTip && <CRTWelcomeTutorialTip/>}
            </li>
        </ul>
    );
};

export default GlobalThreadsLink;
