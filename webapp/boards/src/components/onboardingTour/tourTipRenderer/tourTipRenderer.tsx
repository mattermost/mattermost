// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {Placement} from 'tippy.js'

import {useAppSelector} from 'src/store/hooks'
import {getCurrentBoard} from 'src/store/boards'
import {getCurrentCard} from 'src/store/cards'
import {OnboardingBoardTitle, OnboardingCardTitle} from 'src/components/cardDetail/cardDetail'
import {getOnboardingTourCategory, getOnboardingTourStarted, getOnboardingTourStep} from 'src/store/users'
import TourTip from 'src/components/tutorial_tour_tip/tutorial_tour_tip'
import {TutorialTourTipPunchout} from 'src/components/tutorial_tour_tip/tutorial_tour_tip_backdrop'
import {ClientConfig} from 'src/config/clientConfig'
import {getClientConfig} from 'src/store/clientConfig'

type Props = {
    requireCard: boolean
    category: string
    step: number
    screen: JSX.Element
    title: JSX.Element
    punchout: TutorialTourTipPunchout | null | undefined
    classname: string
    telemetryTag: string
    placement: Placement | undefined
    hideBackdrop: boolean
    imageURL?: string
    singleTip?: boolean
    hideNavButtons?: boolean
    showForce?: boolean
}

const TourTipRenderer = (props: Props): JSX.Element | null => {
    const board = useAppSelector(getCurrentBoard)
    const clientConfig = useAppSelector<ClientConfig>(getClientConfig)

    let isOnboardingBoard = board ? board.title === OnboardingBoardTitle : false
    const onboardingTourStarted = useAppSelector(getOnboardingTourStarted)
    const onboardingTourCategory = useAppSelector(getOnboardingTourCategory)
    const onboardingTourStep = useAppSelector(getOnboardingTourStep)
    const disableTour = clientConfig?.featureFlags?.disableTour || false

    if (props.showForce) {
        isOnboardingBoard = true
    }

    const showTour = !disableTour && isOnboardingBoard && onboardingTourStarted && onboardingTourCategory === props.category
    let showTourTip = showTour && onboardingTourStep === props.step.toString()

    if (props.requireCard) {
        const card = useAppSelector(getCurrentCard)
        const isOnboardingCard = card ? card.title === OnboardingCardTitle : false

        showTourTip = showTourTip && isOnboardingCard
    }

    const currentStep = parseInt(useAppSelector(getOnboardingTourStep), 10)

    if (!showTourTip) {
        return null
    }

    return (
        <TourTip
            screen={props.screen}
            title={props.title}
            punchOut={props.punchout}
            step={currentStep}
            tutorialCategory={props.category}
            placement={props.placement}
            className={props.classname}
            imageURL={props.imageURL}
            telemetryTag={props.telemetryTag}
            skipCategoryFromBackdrop={true}
            autoTour={true}
            hideBackdrop={props.hideBackdrop}
            singleTip={props.singleTip}
            hideNavButtons={props.hideNavButtons}
        />
    )
}

export default TourTipRenderer
