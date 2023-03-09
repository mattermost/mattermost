// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {createSelector} from 'reselect';

import {getCurrentUserId, makeGetProfilesForReactions} from 'mattermost-redux/selectors/entities/users';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';

import {Reaction as ReactionType} from '@mattermost/types/reactions';
import {UserProfile} from '@mattermost/types/users';

import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {GlobalState} from '@mattermost/types/store';

import * as Utils from 'utils/utils';

import ReactionTooltip from './reaction_tooltip';

type OwnProps = {
    reactions: ReactionType[];
};

export const makeGetNamesOfUsers = () => createSelector(
    'makeGetNamesOfUsers',
    (state: GlobalState, reactions: ReactionType[]) => reactions,
    getCurrentUserId,
    makeGetProfilesForReactions(),
    getTeammateNameDisplaySetting,
    (reactions: ReactionType[], currentUserId: string, profiles: UserProfile[], teammateNameDisplay: string) => {
        // Sort users by who reacted first with "you" being first if the current user reacted

        let currentUserReacted = false;
        const sortedReactions = reactions.sort((a, b) => a.create_at - b.create_at);
        const users = sortedReactions.reduce((accumulator, current) => {
            if (current.user_id === currentUserId) {
                currentUserReacted = true;
            } else {
                const user = profiles.find((u) => u.id === current.user_id);
                if (user) {
                    accumulator.push(displayUsername(user, teammateNameDisplay));
                }
            }
            return accumulator;
        }, [] as string[]);

        if (currentUserReacted) {
            users.unshift(Utils.localizeMessage('reaction.you', 'You'));
        }

        return users;
    },
);

function makeMapStateToProps() {
    const getNamesOfUsers = makeGetNamesOfUsers();

    return (state: GlobalState, ownProps: OwnProps) => {
        return {
            users: getNamesOfUsers(state, ownProps.reactions),
        };
    };
}

export default connect(makeMapStateToProps)(ReactionTooltip);
