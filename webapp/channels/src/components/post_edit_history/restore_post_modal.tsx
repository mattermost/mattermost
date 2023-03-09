// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {defineMessages, useIntl} from 'react-intl';

import {t} from 'utils/i18n';

import {Post} from '@mattermost/types/posts';
import GenericModal from 'components/generic_modal';
import PostMessageView from 'components/post_view/post_message_view';

const modalMessages = defineMessages({
    title: {
        id: t('post_info.edit.restore'),
        defaultMessage: 'Restore this version',
    },
    titleQuestion: {
        id: t('post_info.edit.restore_question'),
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
            </div>
        </GenericModal>
    );
};

export default memo(RestorePostModal);
