// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators, Dispatch} from 'redux';

import {GlobalState} from 'types/store';

import {GenericAction} from 'mattermost-redux/types/actions';
import {Post, PostPreviewMetadata} from '@mattermost/types/posts';

import {makeGetChannel} from 'mattermost-redux/selectors/entities/channels';
import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {getPost, isPostPriorityEnabled} from 'mattermost-redux/selectors/entities/posts';

import {isEmbedVisible} from 'selectors/posts';

import {toggleEmbedVisibility} from 'actions/post_actions';

import {Preferences} from 'utils/constants';

import {General} from 'mattermost-redux/constants';

import PostMessagePreview from './post_message_preview';

export type OwnProps = {
    metadata: PostPreviewMetadata;
    previewPost?: Post;
    preventClickAction?: boolean;
    previewFooterMessage?: string;
}

function makeMapStateToProps() {
    const getChannel = makeGetChannel();

    return (state: GlobalState, ownProps: OwnProps) => {
        const config = getConfig(state);
        const currentTeamUrl = getCurrentRelativeTeamUrl(state);
        let user = null;
        let embedVisible = false;
        let channelDisplayName = ownProps.metadata.channel_display_name;
        const previewPost = getPost(state, ownProps.metadata.post_id) || ownProps.previewPost;

        if (previewPost && previewPost.user_id) {
            user = getUser(state, previewPost.user_id);
        }
        if (previewPost && previewPost.id) {
            embedVisible = isEmbedVisible(state, previewPost.id);
        }

        if (ownProps.metadata.channel_type === General.DM_CHANNEL) {
            channelDisplayName = getChannel(state, {id: ownProps.metadata.channel_id}).display_name;
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
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({toggleEmbedVisibility}, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(PostMessagePreview);
