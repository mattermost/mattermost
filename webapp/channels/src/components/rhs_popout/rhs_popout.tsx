// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {Route, Switch, useParams, useRouteMatch} from 'react-router-dom';

import {fetchChannelsAndMembers, getChannelMembers, selectChannel} from 'mattermost-redux/actions/channels';
import {selectTeam} from 'mattermost-redux/actions/teams';
import {getChannelByName} from 'mattermost-redux/selectors/entities/channels';

import {useTeamByName} from 'components/common/hooks/use_team';
import RhsPluginPopout from 'components/rhs_plugin_popout';
import UnreadsStatusHandler from 'components/unreads_status_handler';

import type {GlobalState} from 'types/store';

import './rhs_popout.scss';

export default function RhsPopout() {
    const match = useRouteMatch();

    const dispatch = useDispatch();
    const {team: teamName, identifier: channelIdentifier} = useParams<{team: string; pluginId: string; identifier: string}>();

    const team = useTeamByName(teamName);
    const channel = useSelector((state: GlobalState) => getChannelByName(state, channelIdentifier));

    const teamId = team?.id;
    const channelId = channel?.id;

    useEffect(() => {
        if (channelId) {
            dispatch(selectChannel(channelId));
            dispatch(getChannelMembers(channelId));
        }
    }, [dispatch, channelId]);

    useEffect(() => {
        if (teamId) {
            dispatch(selectTeam(teamId));
            dispatch(fetchChannelsAndMembers(teamId));
        }
    }, [dispatch, teamId]);

    return (
        <>
            <UnreadsStatusHandler/>
            <div className='main-wrapper rhs-popout'>
                <div className='sidebar--right'>
                    <div className='sidebar-right__body'>
                        <Switch>
                            <Route
                                path={`${match.path}/plugin/:pluginId`}
                                component={RhsPluginPopout}
                            />
                        </Switch>
                    </div>
                </div>
            </div>
        </>
    );
}

