// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useState} from 'react';
import type React from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {savePreferences as storeSavePreferences} from 'mattermost-redux/actions/preferences';
import {getCurrentChannelId, getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getInt} from 'mattermost-redux/selectors/entities/preferences';

import {trackEvent as trackEventAction} from 'actions/telemetry_actions';

import {
    generateTelemetryTag,
} from 'components/onboarding_tasks';
import {
    getLastStep,
    isKeyPressed,
    KeyCodes,
    useGetTourSteps,
    useHandleNavigationAndExtraActions,
} from 'components/tours';
import type {
    ActionType,
    ChannelsTourTipManager} from 'components/tours';

import {
    AutoTourStatus,
    ChannelsTour,
    FINISHED,
    SKIPPED,
    TTNameMapToATStatusKey,
} from './constant';

export const useTourTipManager = (tourCategory: string): ChannelsTourTipManager => {
    const [show, setShow] = useState(false);
    const tourSteps = useGetTourSteps(tourCategory);

    // Function to save the tutorial step in redux store start here which needs to be modified
    const dispatch = useDispatch();
    const currentUserId = useSelector(getCurrentUserId);
    const currentChannelId = useSelector(getCurrentChannelId);
    const currentStep = useSelector((state: GlobalState) => getInt(state, tourCategory, currentUserId, 0));
    const autoTourStatus = useSelector((state: GlobalState) => getInt(state, tourCategory, TTNameMapToATStatusKey[tourCategory], 0));
    const isAutoTourEnabled = autoTourStatus === AutoTourStatus.ENABLED;
    const handleActions = useHandleNavigationAndExtraActions(tourCategory);

    const handleSaveDataAndTrackEvent = useCallback(
        (stepValue: number, eventSource: ActionType, autoTour = true, trackEvent = true) => {
            const preferences = [
                {
                    user_id: currentUserId,
                    category: tourCategory,
                    name: currentUserId,
                    value: stepValue.toString(),
                },
                {
                    user_id: currentUserId,
                    category: tourCategory,
                    name: TTNameMapToATStatusKey[tourCategory],
                    value: (autoTour && !(eventSource === 'skipped' || eventSource === 'dismiss') ? AutoTourStatus.ENABLED : AutoTourStatus.DISABLED).toString(),
                },
            ];
            dispatch(storeSavePreferences(currentUserId, preferences));
            if (trackEvent) {
                const eventSuffix = `${stepValue}--${eventSource}`;
                const telemetryTag = generateTelemetryTag(ChannelsTour, tourCategory, eventSuffix);
                trackEventAction(tourCategory, telemetryTag);
            }
        },
        [currentUserId, currentChannelId, tourCategory],
    );

    // Function to save the tutorial step in redux store end here

    const handleEventPropagationAndDefault = (e: React.MouseEvent | KeyboardEvent) => {
        e.stopPropagation();
        e.preventDefault();
    };

    useEffect(() => {
        if (isAutoTourEnabled) {
            setShow(true);
        }
    }, [isAutoTourEnabled]);

    const handleHide = useCallback((): void => {
        setShow(false);
    }, []);

    const handleOpen = useCallback((e: React.MouseEvent): void => {
        handleEventPropagationAndDefault(e);
        setShow(true);
    }, [isAutoTourEnabled]);

    const handleSavePreferences = useCallback((nextStep: boolean | number): void => {
        let stepValue = currentStep;
        let type: ActionType;
        if (nextStep === true) {
            stepValue += 1;
            type = 'next';
        } else if (nextStep === false) {
            stepValue -= 1;
            type = 'prev';
        } else {
            stepValue = nextStep;
            type = 'jump';
        }
        handleHide();
        handleSaveDataAndTrackEvent(stepValue, type);
        handleActions(stepValue, currentStep);
    }, [currentStep, handleHide, handleSaveDataAndTrackEvent, handleActions]);

    const handleDismiss = useCallback((e: React.MouseEvent): void => {
        handleEventPropagationAndDefault(e);
        handleHide();
        handleSaveDataAndTrackEvent(currentStep, 'dismiss', false);
    }, [handleSaveDataAndTrackEvent, handleHide]);

    const handlePrevious = useCallback((e: React.MouseEvent): void => {
        handleEventPropagationAndDefault(e);
        handleSavePreferences(false);
    }, [handleSavePreferences]);

    const handleNext = useCallback((e?: React.MouseEvent): void => {
        if (e) {
            handleEventPropagationAndDefault(e);
        }
        if (getLastStep(tourSteps) === currentStep) {
            handleSavePreferences(FINISHED);
        } else {
            handleSavePreferences(true);
        }
    }, [handleSavePreferences]);

    const handleJump = useCallback((e: React.MouseEvent, jumpStep: number): void => {
        if (e) {
            handleEventPropagationAndDefault(e);
        }
        handleSavePreferences(jumpStep);
    }, [handleSavePreferences]);

    const handleSkip = useCallback((e: React.MouseEvent): void => {
        handleEventPropagationAndDefault(e);
        handleHide();
        handleSaveDataAndTrackEvent(SKIPPED, 'skipped', false);
        handleActions(SKIPPED, currentStep);
    }, [handleSaveDataAndTrackEvent, handleHide]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent): void => {
            if (isKeyPressed(e, KeyCodes.ENTER) && show) {
                handleNext();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () =>
            window.removeEventListener('keydown', handleKeyDown);
    }, [handleNext, show]);

    return {
        show,
        currentStep,
        tourSteps,
        handleOpen,
        handleDismiss,
        handleNext,
        handleJump,
        handlePrevious,
        handleSkip,
    };
};
