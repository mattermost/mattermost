// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import SuggestionStore from 'stores/suggestion_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import UserStore from 'stores/user_store.jsx';
import * as Utils from 'utils/utils.jsx';
import Client from 'utils/web_client.jsx';

import {FormattedMessage} from 'react-intl';
import Suggestion from './suggestion.jsx';

const MaxUserSuggestions = 40;

class AtMentionSuggestion extends Suggestion {
    render() {
        const {item, isSelection} = this.props;

        let username;
        let description;
        let icon;
        if (item.username === 'all') {
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
        } else if (item.username === 'channel') {
            username = 'channel';
            description = (
                <FormattedMessage
                    id='suggestion.mention.channel'
                    defaultMessage='Notifies everyone in the channel'
                />
            );
            icon = <i className='mention__image fa fa-users fa-2x'/>;
        } else {
            username = item.username;
            description = Utils.getFullName(item);
            icon = (
                <img
                    className='mention__image'
                    src={Client.getUsersRoute() + '/' + item.id + '/image?time=' + item.update_at}
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
                        {description}
                    </span>
                </div>
            </div>
        );
    }
}

export default class AtMentionProvider {
    handlePretextChanged(suggestionId, pretext) {
        const captured = (/@([a-z0-9\-\._]*)$/i).exec(pretext.toLowerCase());
        if (captured) {
            const prefix = captured[1];

            const users = UserStore.getActiveOnlyProfiles(true);

            const filtered = [];

            for (const id of Object.keys(users)) {
                const user = users[id];

                if (user.delete_at > 0) {
                    continue;
                }

                if (user.username.startsWith(prefix) ||
                    (user.first_name && user.first_name.toLowerCase().startsWith(prefix)) ||
                    (user.last_name && user.last_name.toLowerCase().startsWith(prefix)) ||
                    (user.nickname && user.nickname.toLowerCase().startsWith(prefix))) {
                    filtered.push(user);
                }

                if (filtered.length >= MaxUserSuggestions) {
                    break;
                }
            }

            if (!pretext.startsWith('/msg')) {
                // add dummy users to represent the @channel and @all special mentions when not using the /msg command
                if ('channel'.startsWith(prefix)) {
                    filtered.push({username: 'channel'});
                }
                if ('all'.startsWith(prefix)) {
                    filtered.push({username: 'all'});
                }
            }

            filtered.sort((a, b) => {
                const aPrefix = a.username.startsWith(prefix);
                const bPrefix = b.username.startsWith(prefix);

                if (aPrefix === bPrefix) {
                    return a.username.localeCompare(b.username);
                } else if (aPrefix) {
                    return -1;
                }

                return 1;
            });

            const mentions = filtered.map((user) => '@' + user.username);

            SuggestionStore.addSuggestions(suggestionId, mentions, filtered, AtMentionSuggestion, captured[0]);
        }
    }
}
