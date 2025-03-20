// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {useDispatch} from 'react-redux';

import type {Feedback} from '@mattermost/types/cloud';

import {trackEvent} from 'actions/telemetry_actions';
import {openModal, closeModal} from 'actions/views/modals';

import DowngradeModal from 'components/downgrade_modal';
import DowngradeFeedbackModal from 'components/feedback_modal/downgrade_feedback';

import {ModalIdentifiers, CloudLinks, TELEMETRY_CATEGORIES} from 'utils/constants';

/**
 * A hook that provides a function to handle the downgrade feedback flow.
 *
 * This hook encapsulates the logic for gathering downgrade feedback
 * before redirecting the user to the pricing page.
 */
export default function useHandleDowngradeFeedback() {
    const dispatch = useDispatch();

    const handleDowngradeFeedback = useCallback(() => {
        trackEvent(TELEMETRY_CATEGORIES.CLOUD_ADMIN, 'click_start_downgrade_workflow', {
            callerInfo: 'downgrade_flow',
        });

        // Opens the feedback modal first to collect feedback
        dispatch(openModal({
            modalId: ModalIdentifiers.FEEDBACK,
            dialogType: DowngradeFeedbackModal,
            dialogProps: {
                onSubmit: (feedback: Feedback) => {
                    // Log the feedback for analytics
                    trackEvent(TELEMETRY_CATEGORIES.CLOUD_ADMIN, 'submitted_downgrade_feedback', {
                        reason: feedback.reason,
                        comments: feedback.comments ? 'true' : 'false',
                    });

                    // Close the feedback modal
                    dispatch(closeModal(ModalIdentifiers.FEEDBACK));

                    // Show the downgrade processing modal
                    dispatch(openModal({
                        modalId: ModalIdentifiers.DOWNGRADE_MODAL,
                        dialogType: DowngradeModal,
                    }));

                    // After a short delay, redirect to pricing page
                    setTimeout(() => {
                        dispatch(closeModal(ModalIdentifiers.DOWNGRADE_MODAL));
                        window.open(CloudLinks.PRICING, '_blank', 'noopener,noreferrer');
                    }, 3000);
                },
            },
        }));
    }, [dispatch]);

    return handleDowngradeFeedback;
}
