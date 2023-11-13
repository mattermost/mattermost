// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';

import type {FileInfo} from '@mattermost/types/files';
import type {Post} from '@mattermost/types/posts';

import type {ExtendedPost} from 'mattermost-redux/actions/posts';
import {removePost} from 'mattermost-redux/actions/posts';
import type {ActionResult, GenericAction} from 'mattermost-redux/types/actions';

import {createPost} from 'actions/post_actions';

import FailedPostOptions from './failed_post_options';

type Actions = {
    createPost: (post: Post, files: FileInfo[]) => Promise<ActionResult>;
    removePost: (post: ExtendedPost) => void;
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject, Actions>({
            createPost,
            removePost,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(FailedPostOptions);
