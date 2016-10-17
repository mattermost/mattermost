// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Suggestion from './suggestion.jsx';

import ChannelStore from 'stores/channel_store.jsx';

import {autocompleteUsersInChannel} from 'actions/user_actions.jsx';

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import * as Utils from 'utils/utils.jsx';
import Client from 'client/web_client.jsx';
import {Constants, ActionTypes} from 'utils/constants.jsx';

import React from 'react';
import {FormattedMessage} from 'react-intl';

class AtMentionSuggestion extends Suggestion {
    render() {
        const isSelection = this.props.isSelection;
        const user = this.props.item;

        let username;
        let description;
        let icon;
        if (user.username === 'all') {
            username = 'all';
            description = (
                <FormattedMessage
                    id='suggestion.mention.all'
                    defaultMessage='Notifies everyone in the channel, use in {townsquare} to notify the whole team'
                    values={{
                        townsquare: ChannelStore.getByName('town-square').display_name
                    }}
                />
            );
            icon = <i className='mention__image fa fa-users fa-2x'/>;
        } else if (user.username === 'channel') {
            username = 'channel';
            description = (
                <FormattedMessage
                    id='suggestion.mention.channel'
                    defaultMessage='Notifies everyone in the channel'
                />
            );
            icon = <i className='mention__image fa fa-users fa-2x'/>;
        } else if (user.username === 'here') {
            username = 'here';
            description = (
                <FormattedMessage
                    id='suggestion.mention.here'
                    defaultMessage='Notifies everyone in the channel and online'
                />
            );
            icon = <i className='mention__image fa fa-users fa-2x'/>;
        } else {
            username = user.username;

            if ((user.first_name || user.last_name) && user.nickname) {
                description = `- ${Utils.getFullName(user)} (${user.nickname})`;
            } else if (user.nickname) {
                description = `- (${user.nickname})`;
            } else if (user.first_name || user.last_name) {
                description = `- ${Utils.getFullName(user)}`;
            }

            icon = (
                <img
                    className='mention__image'
                    src={Client.getUsersRoute() + '/' + user.id + '/image?time=' + user.update_at}
                />
            );
        }

        let className = 'mentions__name';
        if (isSelection) {
            className += ' suggestion--selected';
        }

        return (
            <div
                className={className}
                onClick={this.handleClick}
            >
                <div className='pull-left'>
                    {icon}
                </div>
                <div className='pull-left mention--align'>
                    <span>
                        {'@' + username}
                    </span>
                    <span className='mention__fullname'>
                        {' '}
                        {description}
                    </span>
                </div>
            </div>
        );
    }
}

export default class AtMentionProvider {
    constructor(channelId) {
        this.channelId = channelId;
        this.timeoutId = '';
    }

    componentWillUnmount() {
        clearTimeout(this.timeoutId);
    }

    handlePretextChanged(suggestionId, pretext) {
        clearTimeout(this.timeoutId);

        const captured = (/@([a-z0-9\-\._]*)$/i).exec(pretext.toLowerCase());
        if (captured) {
            const prefix = captured[1];

            function autocomplete() {
                autocompleteUsersInChannel(
                    prefix,
                    this.channelId,
                    (data) => {
                        const members = data.in_channel;
                        for (const id of Object.keys(members)) {
                            members[id].type = Constants.MENTION_MEMBERS;
                        }

                        const nonmembers = data.out_of_channel;
                        for (const id of Object.keys(nonmembers)) {
                            nonmembers[id].type = Constants.MENTION_NONMEMBERS;
                        }

                        let specialMentions = [];
                        if (!pretext.startsWith('/msg')) {
                            specialMentions = ['here', 'channel', 'all'].filter((item) => {
                                return item.startsWith(prefix);
                            }).map((name) => {
                                return {username: name, type: Constants.MENTION_SPECIAL};
                            });
                        }

                        const users = members.concat(specialMentions).concat(nonmembers);
                        const mentions = users.map((user) => '@' + user.username);

                        AppDispatcher.handleServerAction({
                            type: ActionTypes.SUGGESTION_RECEIVED_SUGGESTIONS,
                            id: suggestionId,
                            matchedPretext: captured[0],
                            terms: mentions,
                            items: users,
                            component: AtMentionSuggestion
                        });
                    }
                );
            }

            this.timeoutId = setTimeout(
                autocomplete.bind(this),
                Constants.AUTOCOMPLETE_TIMEOUT
            );
        }
    }
}
