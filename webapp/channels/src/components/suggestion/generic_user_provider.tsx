// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Client4} from 'mattermost-redux/client';
import {isGuest} from 'mattermost-redux/utils/user_utils';

import BotTag from 'components/widgets/tag/bot_tag';
import GuestTag from 'components/widgets/tag/guest_tag';
import Avatar from 'components/widgets/users/avatar';

import * as Utils from 'utils/utils';

import {UserAutocomplete, UserProfile} from './command_provider/app_command_parser/app_command_parser_dependencies.js';
import Provider, {ResultsCallback} from './provider';
import {SuggestionContainer, SuggestionProps} from './suggestion';

const GenericUserSuggestion = React.forwardRef<HTMLDivElement, SuggestionProps<UserProfile>>((props, ref) => {
    const {item} = props;

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
        <SuggestionContainer
            ref={ref}
            {...props}
        >
            <Avatar
                size='xxs'
                username={username}
                url={Client4.getUsersRoute() + '/' + item.id + '/image?_=' + (item.last_picture_update || 0)}
            />
            <div className='suggestion-list__ellipsis'>
                <span className='suggestion-list__main'>
                    {'@' + username}
                </span>
                {description}
            </div>
            {item.is_bot && <BotTag/>}
            {isGuest(item.roles) && <GuestTag/>}
        </SuggestionContainer>
    );
});
GenericUserSuggestion.displayName = 'GenericUserSuggestion';

export default class GenericUserProvider extends Provider {
    autocompleteUsers: (text: string) => Promise<UserAutocomplete>;

    constructor(searchUsersFunc: (username: string) => Promise<UserAutocomplete>) {
        super();
        this.autocompleteUsers = searchUsersFunc;
    }

    handlePretextChanged(pretext: string, resultsCallback: ResultsCallback<UserProfile>) {
        const normalizedPretext = pretext.toLowerCase();
        this.startNewRequest(normalizedPretext);

        this.autocompleteUsers(normalizedPretext).then((data) => {
            if (this.shouldCancelDispatch(normalizedPretext)) {
                return;
            }

            const users = data.users;

            resultsCallback({
                matchedPretext: normalizedPretext,
                terms: users.map((user: UserProfile) => user.username),
                items: users,
                component: GenericUserSuggestion,
            });
        });

        return true;
    }
}
