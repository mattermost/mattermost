// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useParams} from 'react-router-dom';

import {fetchChannelsAndMembers} from 'mattermost-redux/actions/channels';
import {selectTeam} from 'mattermost-redux/actions/teams';
import {getTeamByName} from 'mattermost-redux/selectors/entities/teams';

import LoadingScreen from 'components/loading_screen';
import SearchResultsHeader from 'components/search_results_header';

import {initializePlugins} from 'plugins';
import Pluggable from 'plugins/pluggable';

import type {GlobalState} from 'types/store';

export default function RhsPluginPopout() {
    const dispatch = useDispatch();
    const {pluginId, team: teamName} = useParams<{team: string; pluginId: string}>();

    const team = useSelector((state: GlobalState) => getTeamByName(state, teamName));
    const {showPluggable, pluggableId, title} = useSelector((state: GlobalState) => {
        const rhsPlugins = state.plugins.components.RightHandSidebarComponent;
        const pluginComponent = rhsPlugins.find((element) => element.pluginId === pluginId);
        const pluginTitle = pluginComponent ? pluginComponent.title : '';
        const componentId = pluginComponent ? pluginComponent.id : '';

        return {
            showPluggable: Boolean(pluginComponent),
            pluggableId: componentId,
            title: pluginTitle,
        };
    });

    const teamId = team?.id;
    useEffect(() => {
        if (teamId) {
            dispatch(fetchChannelsAndMembers(teamId));
            dispatch(selectTeam(teamId));
        }
    }, [dispatch, teamId]);

    useEffect(() => {
        initializePlugins();
    }, []);

    if (!showPluggable) {
        return <LoadingScreen/>;
    }

    return (
        <>
            <SearchResultsHeader>
                {title}
            </SearchResultsHeader>
            <Pluggable
                pluggableName='RightHandSidebarComponent'
                pluggableId={pluggableId}
            />
        </>
    );
}

