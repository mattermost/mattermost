// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {PostPreviewMetadata} from '@mattermost/types/posts';

import {General} from 'mattermost-redux/constants';
import {getDirectTeammate, isMyChannelAutotranslated} from 'mattermost-redux/selectors/entities/channels';
import {getConfig, getFeatureFlagValue, isPermissionPoliciesEnabled} from 'mattermost-redux/selectors/entities/general';
import {getPost, isPostPriorityEnabled} from 'mattermost-redux/selectors/entities/posts';
import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';
import {getUser, makeGetDisplayName} from 'mattermost-redux/selectors/entities/users';

import {toggleEmbedVisibility} from 'actions/post_actions';
import {isEmbedVisible} from 'selectors/posts';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

import PostMessagePreview from './post_message_preview';

export type OwnProps = {
    metadata: PostPreviewMetadata;
    preventClickAction?: boolean;
    previewFooterMessage?: string;
    usePostAsSource?: boolean;
};

function makeMapStateToProps() {
    const getDisplayName = makeGetDisplayName();

    return (state: GlobalState, ownProps: OwnProps) => {
        const config = getConfig(state);
        const currentTeamUrl = getCurrentRelativeTeamUrl(state);
        let user = null;
        let embedVisible = false;
        let channelDisplayName = ownProps.metadata.channel_display_name;
        const previewPost = ownProps.metadata.post || getPost(state, ownProps.metadata.post_id);

        if (previewPost && previewPost.user_id) {
            user = getUser(state, previewPost.user_id);
        }
        if (previewPost && previewPost.id) {
            embedVisible = isEmbedVisible(state, previewPost.id);
        }

        if (ownProps.metadata.channel_type === General.DM_CHANNEL) {
            const teammate = getDirectTeammate(state, ownProps.metadata.channel_id);
            channelDisplayName = getDisplayName(state, teammate?.id ?? '');
        }

        return {
            currentTeamUrl,
            channelDisplayName,
            hasImageProxy: config.HasImageProxy === 'true',
            enablePostIconOverride: config.EnablePostIconOverride === 'true',
            previewPost,
            user,
            isEmbedVisible: embedVisible,
            compactDisplay: get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.MESSAGE_DISPLAY, Preferences.MESSAGE_DISPLAY_DEFAULT) === Preferences.MESSAGE_DISPLAY_COMPACT,
            isPostPriorityEnabled: isPostPriorityEnabled(state),
            isChannelAutotranslated: isMyChannelAutotranslated(state, previewPost?.channel_id),
            permissionPoliciesEnabled: isPermissionPoliciesEnabled(state),
            mmBlocksEnabled: getFeatureFlagValue(state, 'MmBlocksEnabled') === 'true',
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({toggleEmbedVisibility}, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(PostMessagePreview);
