// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {bottom} from '@popperjs/core'

import {FormattedMessage} from 'react-intl'

import {useMeasurePunchouts} from 'src/components/tutorial_tour_tip/hooks'

import {BaseTourSteps, TOUR_BASE} from 'src/components/onboardingTour/index'

import './open_card.scss'
import {OnboardingCardClassName} from 'src/components/kanban/kanbanCard'
import TourTipRenderer from 'src/components/onboardingTour/tourTipRenderer/tourTipRenderer'

const OpenCardTourStep = (): JSX.Element | null => {
    const title = (
        <FormattedMessage
            id='OnboardingTour.OpenACard.Title'
            defaultMessage='Open a card'
        />
    )
    const screen = (
        <FormattedMessage
            id='OnboardingTour.OpenACard.Body'
            defaultMessage='Open a card to explore the powerful ways that Boards can help you organize your work.'
        />
    )

    const punchout = useMeasurePunchouts([`.${OnboardingCardClassName}`], [])

    return (
        <TourTipRenderer
            key='OpenCardTourStep'
            requireCard={false}
            category={TOUR_BASE}
            step={BaseTourSteps.OPEN_A_CARD}
            screen={screen}
            title={title}
            punchout={punchout}
            classname='OpenCardTourStep'
            telemetryTag='tourPoint1'
            placement={bottom}
            singleTip={true}
            hideNavButtons={true}
            hideBackdrop={false}
        />
    )
}

export default OpenCardTourStep
