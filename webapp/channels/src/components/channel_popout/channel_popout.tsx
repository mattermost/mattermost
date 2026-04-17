// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useParams} from 'react-router-dom';

import {isDesktopApp} from '@mattermost/shared/utils/user_agent';
import type {ChannelType} from '@mattermost/types/channels';

import {fetchMyCategories} from 'mattermost-redux/actions/channel_categories';
import {fetchChannelsAndMembers, getChannelStats} from 'mattermost-redux/actions/channels';
import {fetchTeamScheduledPosts} from 'mattermost-redux/actions/scheduled_posts';
import {selectTeam} from 'mattermost-redux/actions/teams';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import {getIsRhsOpen} from 'selectors/rhs';

import ChannelIdentifierRouter from 'components/channel_layout/channel_identifier_router';
import {useTeamByName} from 'components/common/hooks/use_team';
import LoadingScreen from 'components/loading_screen';
import SidebarRight from 'components/sidebar_right';
import UnreadsStatusHandler from 'components/unreads_status_handler';

import Constants from 'utils/constants';
import usePopoutFocus from 'utils/popouts/use_popout_focus';
import usePopoutTitle from 'utils/popouts/use_popout_title';

import './channel_popout.scss';

export function getPopoutChannelTitle(channelType?: ChannelType) {
    if (channelType === Constants.DM_CHANNEL || channelType === Constants.GM_CHANNEL) {
        return {id: 'channel_popout.title.dm', defaultMessage: '{channelName} - {serverName}'};
    }
    return {id: 'channel_popout.title', defaultMessage: '{channelName} - {teamName} - {serverName}'};
}

export default function ChannelPopout() {
    const dispatch = useDispatch();
    const {team: teamName, postid} = useParams<{team: string; path: string; identifier: string; postid?: string}>();

    const team = useTeamByName(teamName);
    const teamId = team?.id;

    const channel = useSelector(getCurrentChannel);
    const channelId = channel?.id;

    const rhsOpen = useSelector(getIsRhsOpen);

    usePopoutTitle(getPopoutChannelTitle(channel?.type));
    usePopoutFocus(channelId);

    useEffect(() => {
        if (teamId) {
            dispatch(selectTeam(teamId));
            dispatch(fetchChannelsAndMembers(teamId));
            dispatch(fetchMyCategories(teamId));
            dispatch(fetchTeamScheduledPosts(teamId, true));
        }
    }, [dispatch, teamId]);

    useEffect(() => {
        if (channelId) {
            dispatch(getChannelStats(channelId));
        }
    }, [dispatch, channelId]);

    if (!team) {
        return <LoadingScreen/>;
    }

    return (
        <>
            {isDesktopApp() && <UnreadsStatusHandler/>}
            <div className={classNames('main-wrapper', 'channel-popout', {'rhs-open': rhsOpen})}>
                <div
                    id='channel_view'
                    className='channel-view'
                >
                    <div className='container-fluid channel-view-inner'>
                        <div className='inner-wrap channel__wrap'>
                            <div className='row main'>
                                <ChannelIdentifierRouter key={postid || 'channel'}/>
                            </div>
                        </div>
                    </div>
                </div>
                <SidebarRight/>
            </div>
        </>
    );
}
