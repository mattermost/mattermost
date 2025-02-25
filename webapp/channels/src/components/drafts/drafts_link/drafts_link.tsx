// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useEffect, useMemo, useRef} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';
import {NavLink, useRouteMatch} from 'react-router-dom';

import {fetchTeamScheduledPosts} from 'mattermost-redux/actions/scheduled_posts';
import {syncedDraftsAreAllowedAndEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {
    getScheduledPostsByTeamCount, hasScheduledPostError, isScheduledPostsEnabled,
} from 'mattermost-redux/selectors/entities/scheduled_posts';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {getDrafts} from 'actions/views/drafts';
import {makeGetDraftsCount} from 'selectors/drafts';

import DraftsTourTip from 'components/drafts/drafts_link/drafts_tour_tip/drafts_tour_tip';
import ChannelMentionBadge from 'components/sidebar/sidebar_channel/channel_mention_badge';
import WithTooltip from 'components/with_tooltip';

import {SCHEDULED_POST_URL_SUFFIX} from 'utils/constants';

import type {GlobalState} from 'types/store';

const getDraftsCount = makeGetDraftsCount();

import './drafts_link.scss';

const scheduleIcon = (
    <i
        data-testid='scheduledPostIcon'
        className='icon icon-draft-indicator icon-clock-send-outline'
    />
);

const pencilIcon = (
    <i
        data-testid='draftIcon'
        className='icon icon-draft-indicator icon-pencil-outline'
    />
);

function DraftsLink() {
    const dispatch = useDispatch();

    const initialScheduledPostsLoaded = useRef(false);

    const syncedDraftsAllowedAndEnabled = useSelector(syncedDraftsAreAllowedAndEnabled);
    const draftCount = useSelector(getDraftsCount);
    const teamId = useSelector(getCurrentTeamId);
    const teamScheduledPostCount = useSelector((state: GlobalState) => getScheduledPostsByTeamCount(state, teamId, true));
    const isScheduledPostEnabled = useSelector(isScheduledPostsEnabled);

    const hasDrafts = draftCount > 0;
    const hasScheduledPosts = teamScheduledPostCount > 0;
    const itemsExist = hasDrafts || (isScheduledPostEnabled && hasScheduledPosts);

    const scheduledPostsHasError = useSelector((state: GlobalState) => hasScheduledPostError(state, teamId));

    const {url} = useRouteMatch();
    const isDraftUrlMatch = useRouteMatch('/:team/drafts');
    const isScheduledPostUrlMatch = useRouteMatch('/:team/' + SCHEDULED_POST_URL_SUFFIX);

    const urlMatches = isDraftUrlMatch || isScheduledPostUrlMatch;

    useEffect(() => {
        if (syncedDraftsAllowedAndEnabled) {
            dispatch(getDrafts(teamId));
        }
    }, [teamId, syncedDraftsAllowedAndEnabled, dispatch]);

    useEffect(() => {
        const loadDMsAndGMs = !initialScheduledPostsLoaded.current;

        if (isScheduledPostEnabled) {
            dispatch(fetchTeamScheduledPosts(teamId, loadDMsAndGMs));
        }

        initialScheduledPostsLoaded.current = true;
    }, [dispatch, isScheduledPostEnabled, teamId]);

    const showScheduledPostCount = isScheduledPostEnabled && teamScheduledPostCount > 0;

    const tooltipText = useMemo(() => {
        const lineBreaks = (x: React.ReactNode) => {
            if (draftCount > 0 && teamScheduledPostCount > 0) {
                return (<><br/>{x}</>);
            }

            return null;
        };

        return (
            <FormattedMessage
                id='drafts.tooltipText'
                defaultMessage=''
                values={{
                    draftCount,
                    scheduledPostCount: teamScheduledPostCount,
                    br: lineBreaks,
                }}
            />
        );
    }, [draftCount, teamScheduledPostCount]);

    if (!itemsExist && !urlMatches) {
        return null;
    }

    return (
        <ul className='SidebarDrafts NavGroupContent nav nav-pills__container'>
            <li
                className='SidebarChannel'
                tabIndex={-1}
                id='sidebar-drafts-button'
            >
                <NavLink
                    to={`${url}/drafts`}
                    id='sidebarItem_drafts'
                    activeClassName='active'
                    draggable='false'
                    className='SidebarLink sidebar-item'
                    tabIndex={0}
                >
                    <i
                        data-testid='sendPostIcon'
                        className='icon icon-send-post icon-send'
                    />
                    <div className='SidebarChannelLinkLabel_wrapper'>
                        <span className='SidebarChannelLinkLabel sidebar-item__name'>
                            <FormattedMessage
                                id='drafts.sidebarLink'
                                defaultMessage='Drafts'
                            />
                        </span>
                    </div>
                    <WithTooltip
                        title={tooltipText}
                    >
                        <div>
                            {
                                draftCount > 0 &&
                                <ChannelMentionBadge
                                    unreadMentions={draftCount}
                                    icon={pencilIcon}
                                />
                            }

                            {
                                showScheduledPostCount &&
                                <ChannelMentionBadge
                                    unreadMentions={teamScheduledPostCount}
                                    icon={scheduleIcon}
                                    className={classNames('scheduledPostBadge', {persistent: scheduledPostsHasError})}
                                    hasUrgent={scheduledPostsHasError}
                                />
                            }
                        </div>
                    </WithTooltip>
                </NavLink>
                <DraftsTourTip/>
            </li>
        </ul>
    );
}

export default memo(DraftsLink);
