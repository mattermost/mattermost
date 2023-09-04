// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {
    getMyGroupMentionKeysForChannel,
    getMyGroupMentionKeys,
} from 'mattermost-redux/selectors/entities/groups';
import {getCurrentUserMentionKeys} from 'mattermost-redux/selectors/entities/users';
import {GlobalState} from 'types/store';
import {canManageMembers} from 'utils/channel_utils';
import {MentionKey} from 'utils/text_formatting';

import {getBool} from 'mattermost-redux/selectors/entities/preferences';

import {Preferences} from 'utils/constants';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

import {Channel} from '@mattermost/types/channels';
import {Post} from '@mattermost/types/posts';

import PostMarkdown from './post_markdown';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

export function makeGetMentionKeysForPost(): (
    state: GlobalState,
    post?: Post,
    channel?: Channel
) => MentionKey[] {
    return createSelector(
        'makeGetMentionKeysForPost',
        getCurrentUserMentionKeys,
        (state: GlobalState, post?: Post) => post,
        (state: GlobalState, post?: Post, channel?: Channel) =>
            (channel ? getMyGroupMentionKeysForChannel(state, channel.team_id, channel.id) : getMyGroupMentionKeys(state, false)),
        (mentionKeysWithoutGroups, post, groupMentionKeys) => {
            let mentionKeys = mentionKeysWithoutGroups;
            if (!post?.props?.disable_group_highlight) {
                mentionKeys = mentionKeys.concat(groupMentionKeys);
            }

            if (post?.props?.mentionHighlightDisabled) {
                mentionKeys = mentionKeys.filter(
                    (value) => !['@all', '@channel', '@here'].includes(value.key),
                );
            }

            return mentionKeys;
        },
    );
}

type OwnProps = {
    channelId: string;
    mentionKeys: MentionKey[];
    post?: Post;
};

function makeMapStateToProps() {
    const getMentionKeysForPost = makeGetMentionKeysForPost();

    return (state: GlobalState, ownProps: OwnProps) => {
        const channel = getChannel(state, ownProps.channelId);
        const currentTeam = getCurrentTeam(state) || {};
        return {
            channel,
            currentTeam,
            pluginHooks: state.plugins.components.MessageWillFormat,
            hasPluginTooltips: Boolean(state.plugins.components.LinkTooltip),
            isUserCanManageMembers: channel && canManageMembers(state, channel),
            mentionKeys: getMentionKeysForPost(state, ownProps.post, channel),
            isMilitaryTime: getBool(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.USE_MILITARY_TIME, false),
            timezone: getCurrentTimezone(state),
            hideGuestTags: getConfig(state).HideGuestTags === 'true',
        };
    };
}

export default connect(makeMapStateToProps)(PostMarkdown);
