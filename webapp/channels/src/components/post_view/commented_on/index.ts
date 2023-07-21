// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Post} from '@mattermost/types/posts';
import {connect} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import {GlobalState} from 'types/store';
import {getDisplayNameByUser} from 'utils/utils';

import CommentedOn from './commented_on';

type Props = {
    post: Post;
}

function mapStateToProps(state: GlobalState, ownProps: Props) {
    let displayName = '';
    if (ownProps.post) {
        const user = getUser(state, ownProps.post.user_id);
        displayName = getDisplayNameByUser(state, user);
    }

    const config = getConfig(state);
    const enablePostUsernameOverride = config.EnablePostUsernameOverride === 'true';

    return {
        displayName,
        enablePostUsernameOverride,
    };
}

export default connect(mapStateToProps)(CommentedOn);
