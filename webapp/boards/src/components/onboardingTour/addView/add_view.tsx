// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {FormattedMessage} from 'react-intl'

import {useMeasurePunchouts} from 'src/components/tutorial_tour_tip/hooks'

import './add_view.scss'
import changeViews from 'static/changeViews.gif'

import {BoardTourSteps, TOUR_BOARD} from 'src/components/onboardingTour/index'
import TourTipRenderer from 'src/components/onboardingTour/tourTipRenderer/tourTipRenderer'

const AddViewTourStep = (): JSX.Element => {
    const title = (
        <FormattedMessage
            id='OnboardingTour.AddView.Title'
            defaultMessage='Add a new view'
        />
    )
    const screen = (
        <FormattedMessage
            id='OnboardingTour.AddView.Body'
            defaultMessage='Go here to create a new view to organise your board using different layouts.'
        />
    )

    const punchout = useMeasurePunchouts(['.viewSelector'], [])

    return (
        <TourTipRenderer
            key='AddViewTourStep'
            requireCard={false}
            category={TOUR_BOARD}
            step={BoardTourSteps.ADD_VIEW}
            screen={screen}
            title={title}
            punchout={punchout}
            classname='AddViewTourStep'
            telemetryTag='tourPoint3a'
            placement={'bottom-start'}
            imageURL={changeViews}
            hideBackdrop={false}
        />
    )
}

export default AddViewTourStep
