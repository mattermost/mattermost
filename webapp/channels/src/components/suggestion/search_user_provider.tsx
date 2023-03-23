// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import BotTag from 'components/widgets/tag/bot_tag';

import * as Utils from 'utils/utils';
import Avatar from 'components/widgets/users/avatar';
import SharedUserIndicator from 'components/shared_user_indicator';

import {UserProfile} from '@mattermost/types/users';
import {UserAutocomplete} from '@mattermost/types/autocomplete';

import Provider from './provider';
import Suggestion from './suggestion.jsx';
import {ProviderResults} from './generic_user_provider';

class SearchUserSuggestion extends Suggestion {
    private node?: HTMLDivElement | null;
    render() {
        const {item, isSelection} = this.props;

        let className = 'suggestion-list__item';
        if (isSelection) {
            className += ' suggestion--selected';
        }

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
                    className='mention__shared-user-icon'
                    withTooltip={true}
                />
            );
        }

        return (
            <div
                className={className}
                ref={(node) => {
                    this.node = node;
                }}
                onClick={this.handleClick}
                onMouseMove={this.handleMouseMove}
                {...Suggestion.baseProps}
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
            </div>
        );
    }
}

export default class SearchUserProvider extends Provider {
    private autocompleteUsersInTeam: (username: string) => Promise<UserAutocomplete>;
    constructor(userSearchFunc: (username: string) => Promise<UserAutocomplete>) {
        super();
        this.autocompleteUsersInTeam = userSearchFunc;
    }

    handlePretextChanged(pretext: string, resultsCallback: (res: ProviderResults) => void) {
        const captured = (/\bfrom:\s*(\S*)$/i).exec(pretext.toLowerCase());

        this.doAutocomplete(captured, resultsCallback);

        return Boolean(captured);
    }

    async doAutocomplete(captured: RegExpExecArray | null, resultsCallback: (res: ProviderResults) => void) {
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
