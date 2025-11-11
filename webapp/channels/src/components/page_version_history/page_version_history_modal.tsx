// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {Post} from '@mattermost/types/posts';

import PostEditHistory from 'components/post_edit_history/post_edit_history';

import './page_version_history_modal.scss';

type Props = {
    page: Post;
    pageTitle: string;
    onClose: () => void;
};

const PageVersionHistoryModal = ({
    page,
    pageTitle,
    onClose,
}: Props) => {
    const {formatMessage} = useIntl();

    const title = formatMessage({
        id: 'page_version_history.title',
        defaultMessage: 'Version History',
    });

    const noticeMessage = formatMessage({
        id: 'page_version_history.notice',
        defaultMessage: 'Note: Version history shows when changes were made and by whom. Full content restoration is coming in a future update.',
    });

    return (
        <GenericModal
            onExited={onClose}
            modalHeaderText={`${title}: ${pageTitle}`}
            compassDesign={true}
            handleCancel={onClose}
            className='page-version-history-modal'
        >
            <div className='page-version-history-modal__notice'>
                <i className='icon-information-outline'/>
                <span>{noticeMessage}</span>
            </div>
            <div className='page-version-history-modal__content'>
                <PostEditHistory
                    channelDisplayName={''}
                    originalPost={page}
                />
            </div>
        </GenericModal>
    );
};

export default PageVersionHistoryModal;
