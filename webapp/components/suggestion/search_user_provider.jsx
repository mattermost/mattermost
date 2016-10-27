// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Suggestion from './suggestion.jsx';

import {autocompleteUsersInTeam} from 'actions/user_actions.jsx';

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import Client from 'client/web_client.jsx';
import * as Utils from 'utils/utils.jsx';
import {Constants, ActionTypes} from 'utils/constants.jsx';

import React from 'react';

class SearchUserSuggestion extends Suggestion {
    render() {
        const {item, isSelection} = this.props;

        let className = 'search-autocomplete__item';
        if (isSelection) {
            className += ' selected';
        }

        const username = item.username;
        let description = '';

        if ((item.first_name || item.last_name) && item.nickname) {
            description = `- ${Utils.getFullName(item)} (${item.nickname})`;
        } else if (item.nickname) {
            description = `- (${item.nickname})`;
        } else if (item.first_name || item.last_name) {
            description = `- ${Utils.getFullName(item)}`;
        }

        return (
            <div
                className={className}
                onClick={this.handleClick}
            >
                <i className='fa fa fa-plus-square'/>
                <img
                    className='profile-img rounded'
                    src={Client.getUsersRoute() + '/' + item.id + '/image?time=' + item.update_at}
                />
                <div className='mention--align'>
                    <span>
                        {username}
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

export default class SearchUserProvider {
    constructor() {
        this.timeoutId = '';
    }

    componentWillUnmount() {
        clearTimeout(this.timeoutId);
    }

    handlePretextChanged(suggestionId, pretext) {
        clearTimeout(this.timeoutId);

        const captured = (/\bfrom:\s*(\S*)$/i).exec(pretext.toLowerCase());
        if (captured) {
            const usernamePrefix = captured[1];

            function autocomplete() {
                autocompleteUsersInTeam(
                    usernamePrefix,
                    (data) => {
                        const users = data.in_team;
                        const mentions = users.map((user) => user.username);

                        AppDispatcher.handleServerAction({
                            type: ActionTypes.SUGGESTION_RECEIVED_SUGGESTIONS,
                            id: suggestionId,
                            matchedPretext: usernamePrefix,
                            terms: mentions,
                            items: users,
                            component: SearchUserSuggestion
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
