// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';

import {useDispatch, useSelector} from 'react-redux';

import {get, getInt} from 'mattermost-redux/selectors/entities/preferences';
import {GlobalState} from '@mattermost/types/store';

import {savePreferences as storeSavePreferences} from 'mattermost-redux/actions/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {Client4} from 'mattermost-redux/client';

import {FINISHED, SKIPPED, TTCategoriesMapToSteps} from 'src/components/tutorial/tours';

import {KeyCodes, isKeyPressed} from 'src/utils';

export interface TutorialTourTipManager {
    show: boolean;
    tourSteps: Record<string, number>;
    setShow: (value: React.SetStateAction<boolean>) => void;
    getLastStep: () => number;
    handleOpen: (e: React.MouseEvent) => void;
    handleHide: (e: React.MouseEvent) => void;
    handleSkipTutorial: (e: React.MouseEvent) => void;
    handleSavePreferences: (step: number) => void;
    handlePrevious: (e: React.MouseEvent) => void;
    handleNext: (e?: React.MouseEvent) => void;
}

type Props = {
    autoTour?: boolean;
    telemetryTag?: string;
    tutorialCategory: string;
    step: number;
    onNextNavigateTo?: () => void;
    onPrevNavigateTo?: () => void;
    onFinish?: () => void;
    stopPropagation?: boolean;
    preventDefault?: boolean;
}

const useTutorialTourTipManager = ({
    autoTour,
    telemetryTag,
    tutorialCategory,
    onNextNavigateTo,
    onPrevNavigateTo,
    onFinish,
    stopPropagation,
    preventDefault,
}: Props): TutorialTourTipManager => {
    const [show, setShow] = useState(false);
    const tourSteps = TTCategoriesMapToSteps[tutorialCategory];

    // Function to save the tutorial step in redux store start here which needs to be modified
    const dispatch = useDispatch();
    const currentUserId = useSelector(getCurrentUserId);
    const currentStep = useSelector((state: GlobalState) => getInt(state, tutorialCategory, currentUserId, 0));
    const savePreferences = useCallback(
        (userId: string, stepValue: string) => {
            const preferences = [
                {
                    user_id: userId,
                    category: tutorialCategory,
                    name: userId,
                    value: stepValue,
                },
            ];
            dispatch(storeSavePreferences(currentUserId, preferences));
        },
        [dispatch],
    );

    const trackEvent = useCallback((category, event, props?) => {
        Client4.trackEvent(category, event, props);
    }, []);

    // Function to save the tutorial step in redux store end here

    const handleEventPropagationAndDefault = (e: React.MouseEvent | KeyboardEvent) => {
        if (stopPropagation) {
            e.stopPropagation();
        }
        if (preventDefault) {
            e.preventDefault();
        }
    };

    useEffect(() => {
        if (autoTour) {
            setShow(true);
        }
    }, [autoTour]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent): void => {
            if (isKeyPressed(e, KeyCodes.ENTER)) {
                handleNext();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () =>
            window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleHide = (e?: React.MouseEvent): void => {
        if (e) {
            handleEventPropagationAndDefault(e);
        }
        setShow(false);
    };

    const handleOpen = (e: React.MouseEvent): void => {
        handleEventPropagationAndDefault(e);
        setShow(true);
    };

    const handleSavePreferences = (nextStep: boolean | number): void => {
        let stepValue = currentStep;
        if (nextStep === true) {
            stepValue += 1;
        } else if (nextStep === false) {
            stepValue -= 1;
        } else {
            stepValue = nextStep;
        }
        handleHide();
        savePreferences(currentUserId, stepValue.toString());
        if (onNextNavigateTo && nextStep === true && autoTour) {
            onNextNavigateTo();
        } else if (onPrevNavigateTo && nextStep === false && autoTour) {
            onPrevNavigateTo();
        } else if (onFinish && (nextStep === FINISHED || nextStep === SKIPPED)) {
            onFinish();
        }
    };

    const handlePrevious = (e: React.MouseEvent): void => {
        handleEventPropagationAndDefault(e);
        handleSavePreferences(false);
    };

    const handleNext = (e?: React.MouseEvent): void => {
        if (e) {
            handleEventPropagationAndDefault(e);
        }
        if (telemetryTag) {
            const tag = telemetryTag + '_next';
            trackEvent('tutorial', tag);
        }
        if (getLastStep() === currentStep) {
            handleSavePreferences(FINISHED);
        } else {
            handleSavePreferences(true);
        }
    };

    const handleSkipTutorial = (e: React.MouseEvent): void => {
        handleEventPropagationAndDefault(e);

        if (telemetryTag) {
            const tag = telemetryTag + '_skip';
            trackEvent('tutorial', tag);
        }
        handleSavePreferences(SKIPPED);
    };

    const getLastStep = () => {
        return Object.values(tourSteps).reduce((maxStep, candidateMaxStep) => {
            // ignore the "opt out" FINISHED step as the max step.
            if (candidateMaxStep > maxStep && candidateMaxStep !== tourSteps.FINISHED) {
                return candidateMaxStep;
            }
            return maxStep;
        }, Number.MIN_SAFE_INTEGER);
    };

    return {
        show,
        tourSteps,
        setShow,
        handleOpen,
        handleHide,
        handleNext,
        handlePrevious,
        handleSkipTutorial,
        handleSavePreferences,
        getLastStep,
    };
};

export default useTutorialTourTipManager;

export const useTutorialStepper = (category: string, telemetryTag?: string) => {
    const currentUserId = useSelector(getCurrentUserId);
    const currentStep = useSelector((state: GlobalState) => get(state, category, currentUserId, null));
    const dispatch = useDispatch();

    return {
        currentStep,
        setStep: (step: number) => {
            const preferences = [
                {
                    user_id: currentUserId,
                    category,
                    name: currentUserId,
                    value: step.toString(),
                },
            ];
            if (step === SKIPPED && telemetryTag) {
                const tag = telemetryTag + '_skip';
                Client4.trackEvent('tutorial', tag);
            }

            dispatch(storeSavePreferences(currentUserId, preferences));
        },
    };
};
