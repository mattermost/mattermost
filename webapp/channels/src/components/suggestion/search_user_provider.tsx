// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserAutocomplete} from '@mattermost/types/autocomplete';
import type {UserProfile} from '@mattermost/types/users';

import SharedUserIndicator from 'components/shared_user_indicator';
import BotTag from 'components/widgets/tag/bot_tag';
import Avatar from 'components/widgets/users/avatar';

import * as Utils from 'utils/utils';

import Provider from './provider';
import type {ResultsCallback} from './provider';
import {SuggestionContainer} from './suggestion';
import type {SuggestionProps} from './suggestion';

const SearchUserSuggestion = React.forwardRef<HTMLDivElement, SuggestionProps<UserProfile>>((props, ref) => {
    const {item} = props;

    const username = item.username;
    let description = '';

    if ((item.first_name || item.last_name) && item.nickname) {
        description = `${Utils.getFullName(item)} (${item.nickname})`;
    } else if (item.nickname) {
        description = `(${item.nickname})`;
    } else if (item.first_name || item.last_name) {
        description = `${Utils.getFullName(item)}`;
    }

    let sharedIcon;
    if (item.remote_id) {
        sharedIcon = (
            <SharedUserIndicator
                id={`sharedUserIndicator-${item.id}`}
                className='mention__shared-user-icon'
            />
        );
    }

    return (
        <SuggestionContainer
            ref={ref}
            {...props}
        >
            <Avatar
                size='sm'
                username={username}
                url={Utils.imageURLForUser(item.id, item.last_picture_update)}
            />
            <div className='suggestion-list__ellipsis'>
                <span className='suggestion-list__main'>
                    {'@'}{username}
                </span>
                {item.is_bot && <BotTag/>}
                {description}
            </div>
            {sharedIcon}
        </SuggestionContainer>
    );
});
SearchUserSuggestion.displayName = 'SearchUserSuggestion';

export default class SearchUserProvider extends Provider {
    private autocompleteUsersInTeam: (username: string) => Promise<UserAutocomplete>;
    constructor(userSearchFunc: (username: string) => Promise<UserAutocomplete>) {
        super();
        this.autocompleteUsersInTeam = userSearchFunc;
    }

    handlePretextChanged(pretext: string, resultsCallback: ResultsCallback<UserProfile>) {
        const captured = (/\bfrom:\s*(\S*)$/i).exec(pretext.toLowerCase());

        this.doAutocomplete(captured, resultsCallback);

        return Boolean(captured);
    }

    async doAutocomplete(captured: RegExpExecArray | null, resultsCallback: ResultsCallback<UserProfile>) {
        if (!captured) {
            return;
        }

        const usernamePrefix = captured[1];

        this.startNewRequest(usernamePrefix);

        const data = await this.autocompleteUsersInTeam(usernamePrefix);

        if (this.shouldCancelDispatch(usernamePrefix)) {
            return;
        }

        const users = Object.assign([], data.users);
        const mentions = users.map((user: UserProfile) => user.username);

        resultsCallback({
            matchedPretext: usernamePrefix,
            terms: mentions,
            items: users,
            component: SearchUserSuggestion,
        });
    }

    allowDividers() {
        return true;
    }
}
