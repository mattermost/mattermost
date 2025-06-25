// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, lazy} from 'react';
import {useSelector, useDispatch} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getCloudSubscription} from 'mattermost-redux/selectors/entities/cloud';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {makeAsyncComponent} from 'components/async_load';

const CLOUD_PREVIEW_MODAL_SHOWN_PREF = 'cloud_preview_modal_shown';

// Lazy load the controller component and content data together
const PreviewModalController = makeAsyncComponent(
    'PreviewModalController',
    lazy(() => import('./preview_modal_controller')),
);

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

    // Early return if not cloud or not cloud preview - don't load anything else
    if (!isCloud || !isCloudPreview) {
        return null;
    }

    // Only render the controller if we pass the license checks
    return (
        <PreviewModalController
            show={showModal}
            onClose={handleClose}
        />
    );
};

export default CloudPreviewModal;
