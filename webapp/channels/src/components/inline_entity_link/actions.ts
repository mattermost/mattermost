// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getChannelByNameAndTeamName} from 'mattermost-redux/actions/channels';
import {getTeamByName} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {switchTeam} from 'actions/team_actions';
import {switchToChannel} from 'actions/views/channel';

import {focusPost} from 'components/permalink_view/actions';

import {getHistory} from 'utils/browser_history';

import type {ActionFunc} from 'types/store';

import type {InlineEntityType} from './constants';
import {InlineEntityTypes} from './constants';

export function handleInlineEntityClick(type: InlineEntityType, postId: string, teamName: string, channelName: string): ActionFunc {
    return (dispatch, getState) => {
        const state = getState();
        const returnTo = getHistory().location?.pathname || '';

        switch (type) {
        case InlineEntityTypes.POST: {
            const currentUserId = getCurrentUserId(state);
            dispatch(focusPost(postId, returnTo, currentUserId, {skipRedirectReplyPermalink: true}));
            break;
        }
        case InlineEntityTypes.CHANNEL: {
            if (teamName && channelName) {
                dispatch(getChannelByNameAndTeamName(teamName, channelName)).then((result) => {
                    if (result.data) {
                        dispatch(switchToChannel(result.data));
                    }
                });
            }
            break;
        }
        case InlineEntityTypes.TEAM: {
            if (teamName) {
                const team = getTeamByName(state, teamName);
                if (team) {
                    dispatch(switchTeam(`/${team.name}`, team));
                }
            }
            break;
        }
        }
        return {data: true};
    };
}
