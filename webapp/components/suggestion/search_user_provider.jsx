// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import Client from 'client/web_client.jsx';
import SuggestionStore from 'stores/suggestion_store.jsx';
import UserStore from 'stores/user_store.jsx';

import Suggestion from './suggestion.jsx';

class SearchUserSuggestion extends Suggestion {
    render() {
        const {item, isSelection} = this.props;

        let className = 'search-autocomplete__item';
        if (isSelection) {
            className += ' selected';
        }

        return (
            <div
                className={className}
                onClick={this.handleClick}
            >
                <img
                    className='profile-img rounded'
                    src={Client.getUsersRoute() + '/' + item.id + '/image?time=' + item.update_at}
                />
                <i className='fa fa fa-plus-square'></i>{item.username}
            </div>
        );
    }
}

export default class SearchUserProvider {
    handlePretextChanged(suggestionId, pretext) {
        const captured = (/\bfrom:\s*(\S*)$/i).exec(pretext);
        if (captured) {
            const usernamePrefix = captured[1];

            const users = UserStore.getProfiles();
            let filtered = [];

            for (const id of Object.keys(users)) {
                const user = users[id];

                if (user.username.startsWith(usernamePrefix)) {
                    filtered.push(user);
                }
            }

            filtered = filtered.sort((a, b) => a.username.localeCompare(b.username));

            const usernames = filtered.map((user) => user.username);

            SuggestionStore.addSuggestions(suggestionId, usernames, filtered, SearchUserSuggestion, usernamePrefix);
        }
    }
}
