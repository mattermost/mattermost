// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, lazy} from 'react';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getCloudSubscription} from 'mattermost-redux/selectors/entities/cloud';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {makeAsyncComponent} from 'components/async_load';
import WithTooltip from 'components/with_tooltip';

import {useGetCloudPreviewModalContent} from 'hooks/useGetCloudPreviewModalContent';

import type {GlobalState} from 'types/store';

import type {PreviewModalContentData} from './preview_modal_content_data';
import {modalContent} from './preview_modal_content_data';

import './cloud_preview_modal.scss';

const CLOUD_PREVIEW_MODAL_SHOWN_PREF = 'cloud_preview_modal_shown';

// Lazy load the controller component and content data together
const PreviewModalController = makeAsyncComponent(
    'PreviewModalController',
    lazy(() => import('./preview_modal_content_controller')),
);

const CloudPreviewModal: React.FC = () => {
    const intl = useIntl();
    const dispatch = useDispatch();
    const subscription = useSelector(getCloudSubscription);
    const license = useSelector(getLicense);
    const currentUserId = useSelector(getCurrentUserId);
    const team = useSelector(getCurrentTeam);

    const isCloud = license?.Cloud === 'true';
    const isCloudPreview = subscription?.is_cloud_preview === true;

    // Check if modal has been shown before
    const hasModalBeenShown = useSelector((state: GlobalState) => getBool(state, CLOUD_PREVIEW_MODAL_SHOWN_PREF, CLOUD_PREVIEW_MODAL_SHOWN_PREF));

    const [showModal, setShowModal] = useState(false);

    // Fetch dynamic content from the backend
    const {data: dynamicModalContent, loading: contentLoading} = useGetCloudPreviewModalContent();

    const filteredContentByUseCase = React.useCallback((content: PreviewModalContentData[]) => {
        return content.filter((content) => content.useCase === team?.name.replace('-hq', ''));
    }, [team?.name]);

    useEffect(() => {
        // Show modal only if:
        // 1. It's a cloud preview environment
        // 2. Modal hasn't been shown before
        // 3. We have the necessary data loaded
        // 4. There's content to display for the current team
        // 5. Content is not loading

        // Use dynamic content if available and not empty, fallback to hardcoded content
        const contentToUse = (dynamicModalContent && dynamicModalContent.length > 0) ? dynamicModalContent : modalContent;
        const filteredContent = team?.name ? filteredContentByUseCase(contentToUse) : [];
        if (isCloud && isCloudPreview && !hasModalBeenShown && currentUserId && team?.name && filteredContent.length > 0 && !contentLoading) {
            setShowModal(true);
        } else if (hasModalBeenShown) {
            setShowModal(false);
        }
    }, [isCloud, isCloudPreview, hasModalBeenShown, currentUserId, team?.name, dynamicModalContent, contentLoading, filteredContentByUseCase]);

    const handleClose = () => {
        setShowModal(false);

        // Save preference to not show modal again
        if (currentUserId) {
            const preference = {
                user_id: currentUserId,
                category: CLOUD_PREVIEW_MODAL_SHOWN_PREF,
                name: CLOUD_PREVIEW_MODAL_SHOWN_PREF,
                value: 'true',
            };
            dispatch(savePreferences(currentUserId, [preference]));
        }
    };

    const handleOpenModal = () => {
        setShowModal(true);

        // Reset preference to show modal again
        if (currentUserId) {
            const preference = {
                user_id: currentUserId,
                category: CLOUD_PREVIEW_MODAL_SHOWN_PREF,
                name: CLOUD_PREVIEW_MODAL_SHOWN_PREF,
                value: 'false',
            };
            dispatch(savePreferences(currentUserId, [preference]));
        }
    };

    // Early return if not cloud or not cloud preview - don't load anything else
    if (!isCloud || !isCloudPreview) {
        return null;
    }

    // Show FAB only if modal has been shown before and modal is not currently open
    const shouldShowFAB = hasModalBeenShown && !showModal;

    // Only render the controller if we pass the license checks
    // Use dynamic content if available and not empty, fallback to hardcoded content
    const contentToUse = (dynamicModalContent && dynamicModalContent.length > 0) ? dynamicModalContent : modalContent;
    const contentData = team?.name ? filteredContentByUseCase(contentToUse) : [];

    // Show loading state while fetching dynamic content
    if (contentLoading) {
        return null;
    }

    return (
        <>
            <PreviewModalController
                show={showModal}
                onClose={handleClose}
                contentData={contentData}
            />
            {shouldShowFAB && (
                <div
                    className='cloud-preview-modal-fab'
                    data-testid='cloud-preview-fab'
                >
                    <WithTooltip
                        title={intl.formatMessage({
                            id: 'cloud_preview_modal.fab.tooltip',
                            defaultMessage: 'Open overview',
                        })}
                    >
                        <button
                            className='cloud-preview-modal-fab__button'
                            onClick={handleOpenModal}
                            aria-label={intl.formatMessage({
                                id: 'cloud_preview_modal.fab.aria_label',
                                defaultMessage: 'Open cloud preview overview',
                            })}
                        >
                            <i className='icon icon-play-box-multiple-outline'/>
                        </button>
                    </WithTooltip>
                </div>
            )}
        </>
    );
};

export default CloudPreviewModal;
