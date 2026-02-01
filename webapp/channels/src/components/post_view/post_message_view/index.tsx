// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {connect, useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {Preferences} from 'mattermost-redux/constants';
import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';
import {getTheme, getBool} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {getIsRhsExpanded, getIsRhsOpen} from 'selectors/rhs';

import {useDecryptPost} from 'utils/encryption';

import type {GlobalState} from 'types/store';

import PostMessageView from './post_message_view';

type OwnProps = {
    post: Post;
};

function mapStateToProps(state: GlobalState) {
    return {
        enableFormatting: getBool(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'formatting', true),
        isRHSExpanded: getIsRhsExpanded(state),
        isRHSOpen: getIsRhsOpen(state),
        pluginPostTypes: state.plugins.postTypes,
        theme: getTheme(state),
        currentRelativeTeamUrl: getCurrentRelativeTeamUrl(state),
        sharedChannelsPluginsEnabled: getFeatureFlagValue(state, 'EnableSharedChannelsPlugins') === 'true',
    };
}

const ConnectedPostMessageView = connect(mapStateToProps)(PostMessageView);

/**
 * Wrapper component that handles on-the-fly decryption of encrypted posts.
 * When an encrypted post is detected, the hook triggers decryption and updates Redux.
 */
function PostMessageViewWrapper(props: React.ComponentProps<typeof ConnectedPostMessageView> & OwnProps) {
    const userId = useSelector(getCurrentUserId);

    // Trigger decryption if needed - this updates Redux when done
    useDecryptPost(props.post, userId);

    return <ConnectedPostMessageView {...props} />;
}

export default PostMessageViewWrapper;
