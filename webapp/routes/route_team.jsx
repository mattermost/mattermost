// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import * as RouteUtils from 'routes/route_utils.jsx';
import {browserHistory} from 'react-router/es6';

import TeamStore from 'stores/team_store.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';
import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;
import * as AsyncClient from 'utils/async_client.jsx';
import Client from 'client/web_client.jsx';
import ChannelStore from 'stores/channel_store.jsx';

import emojiRoute from 'routes/route_emoji.jsx';
import integrationsRoute from 'routes/route_integrations.jsx';

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
            channel = ChannelStore.getMoreByName(state.params.channel);
        }
        if (!channel) {
            Client.joinChannelByName(
                state.params.channel,
                (data) => {
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
    GlobalActions.emitChannelClickEvent(channel);
    callback();
}

function preNeedsTeam(nextState, replace, callback) {
    // First check to make sure you're in the current team
    // for the current url.
    const teamName = nextState.params.team;
    var team = TeamStore.getByName(teamName);
    const oldTeamId = TeamStore.getCurrentId();

    if (!team) {
        browserHistory.push('/');
        return;
    }

    GlobalActions.emitCloseRightHandSide();

    TeamStore.saveMyTeam(team);
    TeamStore.emitChange();

    // If the old team id is null then we will already have the direct
    // profiles from initial load
    if (oldTeamId != null) {
        AsyncClient.getDirectProfiles();
    }

    var d1 = $.Deferred(); //eslint-disable-line new-cap
    var d2 = $.Deferred(); //eslint-disable-line new-cap

    Client.getChannels(
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_CHANNELS,
                channels: data.channels,
                members: data.members
            });

            d1.resolve();
        },
        (err) => {
            AsyncClient.dispatchError(err, 'getChannels');
            d1.resolve();
        }
    );

    Client.getProfiles(
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_PROFILES,
                profiles: data
            });

            d2.resolve();
        },
        (err) => {
            AsyncClient.dispatchError(err, 'getProfiles');
            d2.resolve();
        }
    );

    $.when(d1, d2).done(() => {
        callback();
    });
}

function onPermalinkEnter(nextState) {
    const postId = nextState.params.postid;
    GlobalActions.emitPostFocusEvent(postId);
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
                            System.import('components/sidebar.jsx'),
                            System.import('components/channel_view.jsx')
                        ]).then(
                        (comarr) => callback(null, {sidebar: comarr[0].default, center: comarr[1].default})
                        );
                    }
                },
                {
                    path: 'pl/:postid',
                    onEnter: onPermalinkEnter,
                    getComponents: (location, callback) => {
                        Promise.all([
                            System.import('components/sidebar.jsx'),
                            System.import('components/permalink_view.jsx')
                        ]).then(
                        (comarr) => callback(null, {sidebar: comarr[0].default, center: comarr[1].default})
                        );
                    }
                },
                {
                    path: 'tutorial',
                    getComponents: (location, callback) => {
                        Promise.all([
                            System.import('components/sidebar.jsx'),
                            System.import('components/tutorial/tutorial_view.jsx')
                        ]).then(
                        (comarr) => callback(null, {sidebar: comarr[0].default, center: comarr[1].default})
                        );
                    }
                }
            ]
        }
    ]
};
