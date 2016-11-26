// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import * as RouteUtils from 'routes/route_utils.jsx';
import {browserHistory} from 'react-router/es6';

import BrowserStore from 'stores/browser_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';
import {loadStatusesForChannelAndSidebar} from 'actions/status_actions.jsx';
import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;
import * as AsyncClient from 'utils/async_client.jsx';
import Client from 'client/web_client.jsx';
import ChannelStore from 'stores/channel_store.jsx';

import emojiRoute from 'routes/route_emoji.jsx';
import integrationsRoute from 'routes/route_integrations.jsx';

import {loadProfilesAndTeamMembersForDMSidebar} from 'actions/user_actions.jsx';

function onChannelEnter(nextState, replace, callback) {
    doChannelChange(nextState, replace, callback);
}

function doChannelChange(state, replace, callback) {
    let channel;
    if (state.location.query.fakechannel) {
        channel = JSON.parse(state.location.query.fakechannel);
    } else {
        channel = ChannelStore.getByName(state.params.channel);

        if (!channel) {
            BrowserStore.setGlobalItem(TeamStore.getCurrentId(), state.params.channel);
            Client.joinChannelByName(
                state.params.channel,
                (data) => {
                    AppDispatcher.handleServerAction({
                        type: ActionTypes.RECEIVED_CHANNEL,
                        channel: data
                    });

                    GlobalActions.emitChannelClickEvent(data);
                    callback();
                },
                () => {
                    if (state.params.team) {
                        replace('/' + state.params.team + '/channels/town-square');
                    } else {
                        replace('/');
                    }
                    callback();
                }
            );
            return;
        }
    }
    BrowserStore.setGlobalItem(TeamStore.getCurrentId(), channel.name);
    GlobalActions.emitChannelClickEvent(channel);
    callback();
}

function preNeedsTeam(nextState, replace, callback) {
    // First check to make sure you're in the current team
    // for the current url.
    const teamName = nextState.params.team;
    const team = TeamStore.getByName(teamName);

    if (!team) {
        browserHistory.push('/');
        return;
    }

    GlobalActions.emitCloseRightHandSide();

    TeamStore.saveMyTeam(team);
    BrowserStore.setGlobalItem('team', team.id);
    TeamStore.emitChange();
    loadProfilesAndTeamMembersForDMSidebar();
    AsyncClient.getMyTeamMembers();
    AsyncClient.getMyChannelMembers();

    const d1 = $.Deferred(); //eslint-disable-line new-cap

    Client.getChannels(
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_CHANNELS,
                channels: data
            });

            loadStatusesForChannelAndSidebar();

            d1.resolve();
        },
        (err) => {
            AsyncClient.dispatchError(err, 'getChannels');
            d1.resolve();
        }
    );

    $.when(d1).done(() => {
        callback();
    });
}

function onPermalinkEnter(nextState, replace, callback) {
    const postId = nextState.params.postid;
    GlobalActions.emitPostFocusEvent(
        postId,
        () => callback()
    );
}

export default {
    path: ':team',
    onEnter: preNeedsTeam,
    indexRoute: {onEnter: (nextState, replace) => replace('/' + nextState.params.team + '/channels/town-square')},
    childRoutes: [
        integrationsRoute,
        emojiRoute,
        {
            getComponents: (location, callback) => {
                System.import('components/needs_team.jsx').then(RouteUtils.importComponentSuccess(callback));
            },
            childRoutes: [
                {
                    path: 'channels/:channel',
                    onEnter: onChannelEnter,
                    getComponents: (location, callback) => {
                        Promise.all([
                            System.import('components/team_sidebar/team_sidebar_controller.jsx'),
                            System.import('components/sidebar.jsx'),
                            System.import('components/channel_view.jsx')
                        ]).then(
                        (comarr) => callback(null, {team_sidebar: comarr[0].default, sidebar: comarr[1].default, center: comarr[2].default})
                        );
                    }
                },
                {
                    path: 'pl/:postid',
                    onEnter: onPermalinkEnter,
                    getComponents: (location, callback) => {
                        Promise.all([
                            System.import('components/team_sidebar/team_sidebar_controller.jsx'),
                            System.import('components/sidebar.jsx'),
                            System.import('components/permalink_view.jsx')
                        ]).then(
                        (comarr) => callback(null, {team_sidebar: comarr[0].default, sidebar: comarr[1].default, center: comarr[2].default})
                        );
                    }
                },
                {
                    path: 'tutorial',
                    getComponents: (location, callback) => {
                        Promise.all([
                            System.import('components/team_sidebar/team_sidebar_controller.jsx'),
                            System.import('components/sidebar.jsx'),
                            System.import('components/tutorial/tutorial_view.jsx')
                        ]).then(
                        (comarr) => callback(null, {team_sidebar: comarr[0].default, sidebar: comarr[1].default, center: comarr[2].default})
                        );
                    }
                }
            ]
        }
    ]
};
