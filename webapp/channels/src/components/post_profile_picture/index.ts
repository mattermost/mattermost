// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {Client4} from 'mattermost-redux/client';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getUser, getStatusForUserId} from 'mattermost-redux/selectors/entities/users';
import {ensureString} from 'mattermost-redux/utils/post_utils';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

import PostProfilePicture from './post_profile_picture';

type Props = {
    userId: string;
    post: Post;
}

function mapStateToProps(state: GlobalState, ownProps: Props) {
    const config = getConfig(state);
    const user = getUser(state, ownProps.userId);
    const enablePostIconOverride = config.EnablePostIconOverride === 'true';
    const availabilityStatusOnPosts = get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.AVAILABILITY_STATUS_ON_POSTS, Preferences.AVAILABILITY_STATUS_ON_POSTS_DEFAULT);
    const overrideIconUrl = enablePostIconOverride && ensureString(ownProps.post?.props?.override_icon_url);
    let overwriteIcon;
    if (overrideIconUrl) {
        overwriteIcon = Client4.getAbsoluteUrl(overrideIconUrl);
    }

    return {
        availabilityStatusOnPosts,
        enablePostIconOverride: config.EnablePostIconOverride === 'true',
        overwriteIcon,
        hasImageProxy: config.HasImageProxy === 'true',
        status: getStatusForUserId(state, ownProps.userId),
        isBot: Boolean(user && user.is_bot),
        user,
    };
}

export default connect(mapStateToProps)(PostProfilePicture);
