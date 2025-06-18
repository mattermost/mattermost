// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {useSelector, useDispatch} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getCloudSubscription} from 'mattermost-redux/selectors/entities/cloud';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {modalContent, PreviewModalContentData} from './preview_modal_content_data';
import PreviewModalController from './preview_modal_controller';
import { getCurrentTeam } from 'mattermost-redux/selectors/entities/teams';

const CLOUD_PREVIEW_MODAL_SHOWN_PREF = 'cloud_preview_modal_shown';

const CloudPreviewModal: React.FC = () => {
    const dispatch = useDispatch();
    const subscription = useSelector(getCloudSubscription);
    const license = useSelector(getLicense);
    const currentUserId = useSelector(getCurrentUserId);
    const team = useSelector(getCurrentTeam);

    const isCloud = license?.Cloud === 'true';
    const isCloudPreview = subscription?.is_cloud_preview === true;

    // Check if modal has been shown before
    const hasModalBeenShown = false;

    const [showModal, setShowModal] = useState(false);

    const filteredContentByUseCase = (content: PreviewModalContentData[]) => {
        return content.filter((content) => content.useCase === team?.name.replace("-hq", ""));
    };

    useEffect(() => {
        // Show modal only if:
        // 1. It's a cloud preview environment
        // 2. Modal hasn't been shown before
        // 3. We have the necessary data loaded
        // 4. There's content to display for the current team
        const filteredContent = team?.name ? filteredContentByUseCase(modalContent) : [];
        if (isCloud && isCloudPreview && !hasModalBeenShown && currentUserId && team?.name && filteredContent.length > 0) {
            setShowModal(true);
        } else if (hasModalBeenShown) {
            setShowModal(false);
        }
    }, [isCloud, isCloudPreview, hasModalBeenShown, currentUserId, team?.name]);

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

    if (!isCloud || !isCloudPreview) {
        return null;
    }

    // TODO: Remove hard coded filter on missionops in favour of dynamic based on selected use case
    return (
        <PreviewModalController
            show={showModal}
            onClose={handleClose}
            contentData={filteredContentByUseCase(modalContent)}
        />
    );
};

export default CloudPreviewModal;
