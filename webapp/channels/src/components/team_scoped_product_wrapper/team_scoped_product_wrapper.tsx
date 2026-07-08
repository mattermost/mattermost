// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {Redirect, useParams} from 'react-router-dom';

import {selectTeam} from 'mattermost-redux/actions/teams';
import {getCurrentTeamId, getTeamByName} from 'mattermost-redux/selectors/entities/teams';

import type {GlobalState} from 'types/store';

type Props = {
    children: React.ReactNode;
};

export default function TeamScopedProductWrapper({children}: Props) {
    const dispatch = useDispatch();
    const {team: teamName} = useParams<{team: string}>();

    const teamId = useSelector((state: GlobalState) => getTeamByName(state, teamName)?.id);
    const currentTeamId = useSelector(getCurrentTeamId);

    useEffect(() => {
        if (teamId && teamId !== currentTeamId) {
            dispatch(selectTeam(teamId));
        }
    }, [teamId, currentTeamId, dispatch]);

    // The user's teams are already loaded before this route can mount (Root gates
    // on loadConfigAndMe, which awaits getMyTeams), so an unresolved teamName is a
    // team the user isn't a member of — redirect rather than render nothing.
    if (!teamId) {
        return <Redirect to='/error?type=team_not_found'/>;
    }

    if (currentTeamId !== teamId) {
        return null;
    }

    return <>{children}</>;
}
