// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Post} from '@mattermost/types/posts';

import {getPageVersionHistory} from 'actions/pages';
import LoadingScreen from 'components/loading_screen';
import EditedPostItem from 'components/post_edit_history/edited_post_item';
import Scrollbars from 'components/common/scrollbars';
import AlertIcon from 'components/common/svg_images_components/alert_svg';

import './page_version_history_modal.scss';

type Props = {
    page: Post;
    pageTitle: string;
    wikiId: string;
    onClose: () => void;
};

const PageVersionHistoryModal = ({
    page,
    pageTitle,
    wikiId,
    onClose,
}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [versionHistory, setVersionHistory] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [hasError, setHasError] = useState<boolean>(false);

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

    const noticeMessage = formatMessage({
        id: 'page_version_history.notice',
        defaultMessage: 'Note: Version history shows when changes were made and by whom. Full content restoration is coming in a future update.',
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
            <div style={{maxHeight: 'calc(100vh - 250px)', overflow: 'auto'}}>
                <Scrollbars>
                    <div className='page-version-history__list'>
                        {versionHistory.map((post) => (
                            <EditedPostItem
                                key={post.id}
                                post={post}
                            />
                        ))}
                    </div>
                </Scrollbars>
            </div>
        );
    }

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
                {content}
            </div>
        </GenericModal>
    );
};

export default PageVersionHistoryModal;
