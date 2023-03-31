// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {FormattedMessage} from 'react-intl'

import {useMeasurePunchouts} from 'src/components/tutorial_tour_tip/hooks'

import './add_description.scss'
import addDescription from 'static/addDescription.png'

import {CardTourSteps, TOUR_CARD} from 'src/components/onboardingTour/index'
import TourTipRenderer from 'src/components/onboardingTour/tourTipRenderer/tourTipRenderer'

const AddDescriptionTourStep = (): JSX.Element | null => {
    const title = (
        <FormattedMessage
            id='OnboardingTour.AddDescription.Title'
            defaultMessage='Add description'
        />
    )
    const screen = (
        <FormattedMessage
            id='OnboardingTour.AddDescription.Body'
            defaultMessage='Add a description to your card so your teammates know what the card is about.'
        />
    )

    const punchout = useMeasurePunchouts(['.octo-content div:nth-child(1)'], [])

    return (
        <TourTipRenderer
            key='AddDescriptionTourStep'
            requireCard={true}
            category={TOUR_CARD}
            step={CardTourSteps.ADD_DESCRIPTION}
            screen={screen}
            title={title}
            punchout={punchout}
            classname='AddDescriptionTourStep'
            telemetryTag='tourPoint2c'
            placement={'top-start'}
            imageURL={addDescription}
            hideBackdrop={true}
        />
    )
}

export default AddDescriptionTourStep
