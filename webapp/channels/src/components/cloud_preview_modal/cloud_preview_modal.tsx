// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {useSelector, useDispatch} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getCloudSubscription} from 'mattermost-redux/selectors/entities/cloud';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import type {PreviewModalContentData} from './preview_modal_content';
import PreviewModalController from './preview_modal_controller';

const CLOUD_PREVIEW_MODAL_SHOWN_PREF = 'cloud_preview_modal_shown';

// Hardcoded content for now
const modalContent: PreviewModalContentData[] = [
    {
        skuLabel: 'ENTERPRISE ADVANCED',
        title: 'Welcome to your Mattermost preview',
        subtitle: 'This hands-on, 1-hour Mattermost Enterprise Advanced lets your team explore secure, mission-critical collaboration. The workspace is preloaded with <strong>sample data</strong> to get started.',
        videoUrl: 'https://www.youtube.com/watch?v=Zpyy2FqGotM', // TODO: Add proper video URL when available
    },
    {
        skuLabel: 'ENTERPRISE',
        title: 'Messaging built for action, not noise',
        subtitle: 'Bring conversations and context together in one platform. Communicate with urgency using priority levels, persistent notifications, and acknowledgements—so critical messages are seen and acted on when every second counts.',
        videoUrl: 'https://www.youtube.com/watch?v=E3EGLxgNxNA', // TODO: Add proper video URL when available
    },
];

const CloudPreviewModal: React.FC = () => {
    const dispatch = useDispatch();
    const subscription = useSelector(getCloudSubscription);
    const license = useSelector(getLicense);
    const currentUserId = useSelector(getCurrentUserId);

    const isCloud = license?.Cloud === 'true';
    const isCloudPreview = subscription?.is_cloud_preview === true;

    // Check if modal has been shown before
    const hasModalBeenShown = false;

    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        // Show modal only if:
        // 1. It's a cloud preview environment
        // 2. Modal hasn't been shown before
        // 3. We have the necessary data loaded
        if (isCloud && isCloudPreview && !hasModalBeenShown && currentUserId) {
            setShowModal(true);
        } else if (hasModalBeenShown) {
            setShowModal(false);
        }
    }, [isCloud, isCloudPreview, hasModalBeenShown, currentUserId]);

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

    return (
        <PreviewModalController
            show={showModal}
            onClose={handleClose}
            contentData={modalContent}
        />
    );
};

export default CloudPreviewModal;
