// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getEditingPostDetailsAndPost} from 'selectors/posts';

import AdvancedTextEditor from 'components/advanced_text_editor/advanced_text_editor';

import {Locations} from 'utils/constants';

import './edit_post.scss';

export default function EditPost() {
    const {formatMessage} = useIntl();

    const editingPostDetailsAndPost = useSelector(getEditingPostDetailsAndPost);

    const channelId = editingPostDetailsAndPost.post.channel_id;
    const location = editingPostDetailsAndPost.isRHS ? Locations.RHS_COMMENT : Locations.CENTER;
    const postId = editingPostDetailsAndPost.post.root_id || editingPostDetailsAndPost.post.id;

    return (
        <div className='post-edit__container'>
            <AdvancedTextEditor
                location={location}
                channelId={channelId}
                postId={postId}
                isThreadView={false}
                isInEditMode={true}
                placeholder={formatMessage({id: 'edit_post.editPost', defaultMessage: 'Edit the post...'})}

                // afterSubmit={afterSubmit}
            />
        </div>
    );
}
