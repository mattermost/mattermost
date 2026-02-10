// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Post} from '@mattermost/types/posts';

import {restorePostVersion} from 'mattermost-redux/actions/posts';

import {getPageVersionHistory} from 'actions/pages';
import {closeModal} from 'actions/views/modals';

import Scrollbars from 'components/common/scrollbars';
import AlertIcon from 'components/common/svg_images_components/alert_svg';
import LoadingScreen from 'components/loading_screen';

import {ModalIdentifiers} from 'utils/constants';

import PageVersionHistoryItem from './page_version_history_item';

import './page_version_history_modal.scss';

type Props = {
    page: Post;
    pageTitle: string;
    wikiId: string;
    onVersionRestored?: () => void;
};

const PageVersionHistoryModal = ({
    page,
    pageTitle,
    wikiId,
    onVersionRestored,
}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [versionHistory, setVersionHistory] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [hasError, setHasError] = useState<boolean>(false);

    const handleClose = () => {
        dispatch(closeModal(ModalIdentifiers.PAGE_VERSION_HISTORY));
    };

    useEffect(() => {
        const fetchVersionHistory = async () => {
            if (!wikiId) {
                setHasError(true);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            const result = await dispatch(getPageVersionHistory(wikiId, page.id));
            if (result.data) {
                setVersionHistory(result.data);
                setHasError(false);
            } else {
                setHasError(true);
                setVersionHistory([]);
            }
            setIsLoading(false);
        };

        fetchVersionHistory();
    }, [page.id, wikiId, dispatch]);

    const title = formatMessage({
        id: 'page_version_history.title',
        defaultMessage: 'Version History',
    });

    const retrieveErrorHeading = formatMessage({
        id: 'post_info.edit.history.retrieveError',
        defaultMessage: 'Unable to load edit history',
    });

    const retrieveErrorSubheading = formatMessage({
        id: 'post_info.edit.history.retrieveErrorVerbose',
        defaultMessage: 'There was an error loading the history for this message. Check your network connection or try again later.',
    });

    let content;
    if (isLoading) {
        content = <LoadingScreen/>;
    } else if (hasError) {
        content = (
            <div className='edit-post-history__error_container'>
                <div className='edit-post-history__error_item'>
                    <AlertIcon
                        width={127}
                        height={127}
                    />
                    <p className='edit-post-history__error_heading'>
                        {retrieveErrorHeading}
                    </p>
                    <p className='edit-post-history__error_subheading'>
                        {retrieveErrorSubheading}
                    </p>
                </div>
            </div>
        );
    } else {
        content = (
            <Scrollbars>
                <div className='page-version-history__list'>
                    {versionHistory.map((post) => (
                        <PageVersionHistoryItem
                            key={post.id}
                            post={post}
                            isCurrent={post.id === page.id}
                            postCurrentVersion={page}
                            isChannelAutotranslated={false}
                            onVersionRestored={onVersionRestored}
                            customHandleUndo={async () => {
                                // To undo a restore, we restore back to the current version (first in history)
                                if (versionHistory.length > 0) {
                                    const currentVersion = versionHistory[0];
                                    await dispatch(restorePostVersion(post.original_id, currentVersion.id, ''));
                                }
                            }}
                        />
                    ))}
                </div>
            </Scrollbars>
        );
    }

    return (
        <GenericModal
            onExited={handleClose}
            modalHeaderText={`${title}: ${pageTitle}`}
            compassDesign={true}
            handleCancel={handleClose}
            className='page-version-history-modal'
            bodyPadding={false}
        >
            <div className='page-version-history-modal__content'>
                {content}
            </div>
        </GenericModal>
    );
};

export default PageVersionHistoryModal;
