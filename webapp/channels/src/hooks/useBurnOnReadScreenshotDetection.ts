// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect} from 'react';
import {useDispatch} from 'react-redux';

import {openModal, closeModal} from 'actions/views/modals';

import BurnOnReadScreenshotWarningModal from 'components/burn_on_read_screenshot_warning_modal/burn_on_read_screenshot_warning_modal';

import {screenshotDetectionManager} from 'utils/burn_on_read_screenshot_detection';
import {ModalIdentifiers} from 'utils/constants';

/**
 * Registers screenshot detection while a revealed BoR message is visible.
 * Shows a warning modal on detection; auto-cleans up on unmount.
 */
export function useBurnOnReadScreenshotDetection(isVisible: boolean): void {
    const dispatch = useDispatch();

    const handleScreenshotDetected = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.BURN_ON_READ_SCREENSHOT_WARNING,
            dialogType: BurnOnReadScreenshotWarningModal,
            dialogProps: {
                show: true,
                onConfirm: () => {
                    dispatch(closeModal(ModalIdentifiers.BURN_ON_READ_SCREENSHOT_WARNING));
                },
            },
        }));
    }, [dispatch]);

    useEffect(() => {
        if (!isVisible) {
            return undefined;
        }

        screenshotDetectionManager.register(handleScreenshotDetected);

        return () => {
            screenshotDetectionManager.unregister();
        };
    }, [isVisible, handleScreenshotDetected]);
}
