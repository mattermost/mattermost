// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getEditingPostDetailsAndPost} from 'selectors/posts';

import AdvancedTextEditor from 'components/advanced_text_editor/advanced_text_editor';

import {Locations, StoragePrefixes} from 'utils/constants';

import './edit_post.scss';

export default function EditPost() {
    const {formatMessage} = useIntl();

    const editingPostDetailsAndPost = useSelector(getEditingPostDetailsAndPost);

    if (!editingPostDetailsAndPost.show) {
        return null;
    }

    const channelId = editingPostDetailsAndPost.post.channel_id;
    const location = editingPostDetailsAndPost.isRHS ? Locations.RHS_COMMENT : Locations.CENTER;
    const storageKey = `${StoragePrefixes.EDIT_DRAFT}${editingPostDetailsAndPost.post.id}`;

    return (
        <div className='post-edit__container'>
            <AdvancedTextEditor
                location={location}
                channelId={channelId}
                rootId={editingPostDetailsAndPost.post.root_id}
                postId={editingPostDetailsAndPost.post.id}
                isInEditMode={true}
                storageKey={storageKey}
                placeholder={formatMessage({id: 'edit_post.editPost', defaultMessage: 'Edit the post...'})}
            />
        </div>
    );
}
