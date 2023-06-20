// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react'

import {useDispatch} from 'react-redux'

import {FINISHED, TOUR_ORDER, TourCategoriesMapToSteps} from 'src/components/onboardingTour'
import {useAppSelector} from 'src/store/hooks'
import {getMe, getOnboardingTourStep, patchProps} from 'src/store/users'
import {UserConfigPatch} from 'src/user'
import octoClient from 'src/octoClient'
import {KeyCodes, Utils} from 'src/utils'
import TelemetryClient, {TelemetryCategory} from 'src/telemetry/telemetryClient'

export interface TutorialTourTipManager {
    show: boolean
    tourSteps: Record<string, number>
    getLastStep: () => number
    handleOpen: (e: React.MouseEvent) => void
    handleHide: (e: React.MouseEvent) => void
    handleSkipTutorial: (e: React.MouseEvent) => void
    handleDismiss: (e: React.MouseEvent) => void
    handleSavePreferences: (step: number) => void
    handlePrevious: (e: React.MouseEvent) => void
    handleNext: (e?: React.MouseEvent) => void
    handleEventPropagationAndDefault: (e: React.MouseEvent | KeyboardEvent) => void
    handleSendToNextTour: (currentTourCategory: string) => Promise<void>
}

export type TutorialTourTipManagerProps = {
    autoTour?: boolean
    telemetryTag?: string
    tutorialCategory: string
    step: number
    onNextNavigateTo?: () => void
    onPrevNavigateTo?: () => void
    stopPropagation?: boolean
    preventDefault?: boolean
}

const useTutorialTourTipManager = ({
    autoTour,
    telemetryTag,
    tutorialCategory,
    onNextNavigateTo,
    onPrevNavigateTo,
    stopPropagation,
    preventDefault,
}: TutorialTourTipManagerProps): TutorialTourTipManager => {
    const [show, setShow] = useState(false)
    const tourSteps = TourCategoriesMapToSteps[tutorialCategory]

    // Function to save the tutorial step in redux store start here which needs to be modified
    const dispatch = useDispatch()
    const me = useAppSelector(getMe)
    const currentUserId = me?.id
    const currentStep = parseInt(useAppSelector(getOnboardingTourStep), 10)
    const savePreferences = useCallback(
        async (useID: string, stepValue: string, tourCategory?: string) => {
            if (!currentUserId) {
                return
            }

            const patch: UserConfigPatch = {
                updatedFields: {
                    onboardingTourStep: stepValue,
                },
            }

            if (tourCategory) {
                patch.updatedFields!.tourCategory = tourCategory
            }

            const patchedProps = await octoClient.patchUserConfig(currentUserId, patch)
            if (patchedProps) {
                await dispatch(patchProps(patchedProps))
            }
        },
        [dispatch],
    )

    const trackEvent = useCallback((category, event, props?) => {
        TelemetryClient.trackEvent(category, event, props)
    }, [])

    const handleEventPropagationAndDefault = (e: React.MouseEvent | KeyboardEvent) => {
        if (stopPropagation) {
            e.stopPropagation()
        }
        if (preventDefault) {
            e.preventDefault()
        }
    }

    const handleKeyDown = useCallback((e: KeyboardEvent): void => {
        if (Utils.isKeyPressed(e, KeyCodes.ENTER) && show) {
            handleNext()
        }
    }, [show])

    useEffect(() => {
        if (autoTour) {
            setShow(true)
        }
    }, [autoTour])

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)

        return () =>
            window.removeEventListener('keydown', handleKeyDown)
    }, [])

    const handleHide = (): void => {
        setShow(false)
    }

    const handleOpen = (e: React.MouseEvent): void => {
        handleEventPropagationAndDefault(e)
        setShow(true)
    }

    const handleDismiss = (e: React.MouseEvent): void => {
        handleEventPropagationAndDefault(e)
        handleHide()
        const tag = telemetryTag + '_skip'
        trackEvent(TelemetryCategory, tag)
    }

    const handleSavePreferences = async (nextStep: boolean | number): Promise<void> => {
        if (!currentUserId) {
            return
        }

        let stepValue = currentStep
        if (nextStep === true) {
            stepValue += 1
        } else if (nextStep === false) {
            stepValue -= 1
        } else {
            stepValue = nextStep
        }
        handleHide()
        await savePreferences(currentUserId, stepValue.toString())
        if (onNextNavigateTo && nextStep === true && autoTour) {
            onNextNavigateTo()
        } else if (onPrevNavigateTo && nextStep === false && autoTour) {
            onPrevNavigateTo()
        }
    }

    const handlePrevious = (e: React.MouseEvent): void => {
        handleEventPropagationAndDefault(e)

        if (telemetryTag) {
            const tag = telemetryTag + '_previous'
            trackEvent(TelemetryCategory, tag)
        }

        handleSavePreferences(false)
    }

    const handleNext = (e?: React.MouseEvent): void => {
        if (e) {
            handleEventPropagationAndDefault(e)
        }
        if (telemetryTag) {
            const tag = telemetryTag + '_next'
            trackEvent(TelemetryCategory, tag)
        }
        if (getLastStep() === currentStep) {
            handleSavePreferences(FINISHED)
        } else {
            handleSavePreferences(true)
        }
    }

    const handleSkipTutorial = (e: React.MouseEvent): void => {
        handleEventPropagationAndDefault(e)

        if (telemetryTag) {
            const tag = telemetryTag + '_skip'
            trackEvent(TelemetryCategory, tag)
        }

        if (currentUserId) {
            savePreferences(currentUserId, FINISHED.toString())
        }
    }

    const getLastStep = () => {
        return Object.values(tourSteps).reduce((maxStep, candidateMaxStep) => {
            // ignore the "opt out" FINISHED step as the max step.
            if (candidateMaxStep > maxStep && candidateMaxStep !== tourSteps.FINISHED) {
                return candidateMaxStep
            }

            return maxStep
        }, Number.MIN_SAFE_INTEGER)
    }

    const handleSendToNextTour = (currentTourCategory: string): Promise<void> => {
        if (!currentUserId) {
            return Promise.resolve()
        }

        const i = TOUR_ORDER.indexOf(currentTourCategory)
        if (i === -1) {
            Utils.logError(`Unknown tour category encountered: ${currentTourCategory}`)
        }

        let stepValue
        let tourCategory: string
        if (i === TOUR_ORDER.length - 1) {
            stepValue = FINISHED
            tourCategory = currentTourCategory
        } else {
            stepValue = 0
            tourCategory = TOUR_ORDER[i + 1]
        }

        return savePreferences(currentUserId, stepValue.toString(), tourCategory)
    }

    return {
        show,
        tourSteps,
        handleOpen,
        handleHide,
        handleDismiss,
        handleNext,
        handlePrevious,
        handleSkipTutorial,
        handleSavePreferences,
        getLastStep,
        handleEventPropagationAndDefault,
        handleSendToNextTour,
    }
}

export default useTutorialTourTipManager
