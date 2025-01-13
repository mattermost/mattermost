// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {defineMessages, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {Post} from '@mattermost/types/posts';

import FileAttachmentListContainer from 'components/file_attachment_list';
import PostMessageView from 'components/post_view/post_message_view';

import './restore_post_history.scss';

const modalMessages = defineMessages({
    title: {
        id: 'post_info.edit.restore',
        defaultMessage: 'Restore this version',
    },
    titleQuestion: {
        id: 'post_info.edit.restore_question',
        defaultMessage: 'Restore this version?',
    },
});

type Props = {
    post: Post;
    postHeader: JSX.Element;
    actions: {
        handleRestore: (post: Post) => void;
    };
    onExited: () => void;
}

const RestorePostModal = ({post, postHeader, actions, onExited}: Props) => {
    const {formatMessage} = useIntl();
    const onHide = () => onExited();

    const handleRestore = async () => {
        await actions.handleRestore(post);
        onHide();
    };

    const modalHeaderText = (
        <div className='edit-post-history__restore__modal__header'>
            {formatMessage(modalMessages.titleQuestion)}
        </div>
    );

    return (
        <GenericModal
            compassDesign={true}
            onExited={onHide}
            enforceFocus={false}
            id='restorePostModal'
            aria-labelledby='restorePostModalLabel'
            modalHeaderText={modalHeaderText}
            handleCancel={onHide}
            cancelButtonClassName='cancel-button'
            handleConfirm={handleRestore}
        >
            <div className='edit-post-history__restore__modal__content'>
                {postHeader}
                <PostMessageView
                    post={post}
                    overflowType='ellipsis'
                    maxHeight={100}
                    showPostEditedIndicator={false}
                />
                <FileAttachmentListContainer
                    post={post}
                    isEditHistory={true}
                    disableDownload={true}
                    disableActions={true}
                />
            </div>
        </GenericModal>
    );
};

export default memo(RestorePostModal);
