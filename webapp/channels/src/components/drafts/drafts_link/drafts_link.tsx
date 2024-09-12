// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useEffect, useMemo, useRef} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';
import {NavLink, useRouteMatch} from 'react-router-dom';

import {syncedDraftsAreAllowedAndEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import fetchTeamScheduledPosts from 'actions/schedule_message';
import {getDrafts} from 'actions/views/drafts';
import {makeGetDraftsCount} from 'selectors/drafts';
import {getScheduledPostsByTeamCount} from 'selectors/scheduled_posts';

import DraftsTourTip from 'components/drafts/drafts_link/drafts_tour_tip/drafts_tour_tip';
import ChannelMentionBadge from 'components/sidebar/sidebar_channel/channel_mention_badge';

import type {GlobalState} from 'types/store';

import {SCHEDULED_POST_URL_SUFFIX} from 'components/drafts/drafts';

import './drafts_link.scss';

const getDraftsCount = makeGetDraftsCount();

function DraftsLink() {
    const dispatch = useDispatch();

    const initialScheduledPostsLoaded = useRef(false);

    const syncedDraftsAllowedAndEnabled = useSelector(syncedDraftsAreAllowedAndEnabled);
    const draftCount = useSelector(getDraftsCount);
    const teamId = useSelector(getCurrentTeamId);
    const teamScheduledPostCount = useSelector((state: GlobalState) => getScheduledPostsByTeamCount(state, teamId));

    const itemsExist = draftCount > 0 || teamScheduledPostCount > 0;

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
        dispatch(fetchTeamScheduledPosts(teamId, loadDMsAndGMs));
        initialScheduledPostsLoaded.current = true;
    }, [teamId]);

    const pencilIcon = useMemo(() => {
        return (
            <i
                data-testid='draftIcon'
                className='icon icon-draft-indicator icon-pencil-outline'
            />
        );
    }, []);

    const scheduleIcon = useMemo(() => {
        return (
            <i
                data-testid='scheduledPostIcon'
                className='icon icon-draft-indicator icon-clock-send-outline'
            />
        );
    }, []);

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
                    {pencilIcon}
                    <div className='SidebarChannelLinkLabel_wrapper'>
                        <span className='SidebarChannelLinkLabel sidebar-item__name'>
                            <FormattedMessage
                                id='drafts.sidebarLink'
                                defaultMessage='Drafts'
                            />
                        </span>
                    </div>
                    {
                        draftCount > 0 &&
                        <ChannelMentionBadge
                            unreadMentions={draftCount}
                            icon={pencilIcon}
                        />
                    }

                    {
                        teamScheduledPostCount > 0 &&
                        <ChannelMentionBadge
                            unreadMentions={teamScheduledPostCount}
                            icon={scheduleIcon}
                        />
                    }
                </NavLink>
                <DraftsTourTip/>
            </li>
        </ul>
    );
}

export default memo(DraftsLink);
