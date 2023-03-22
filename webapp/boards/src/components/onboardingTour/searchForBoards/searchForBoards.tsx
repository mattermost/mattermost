// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {FormattedMessage} from 'react-intl'
import {right} from '@popperjs/core'

import {SidebarTourSteps, TOUR_SIDEBAR} from '..'

import {useMeasurePunchouts} from 'src/components/tutorial_tour_tip/hooks'
import TourTipRenderer from 'src/components/onboardingTour/tourTipRenderer/tourTipRenderer'

import './searchForBoards.scss'

const SearchForBoardsTourStep = (): JSX.Element | null => {
    const title = (
        <FormattedMessage
            id='SidebarTour.SearchForBoards.Title'
            defaultMessage='Search for boards'
        />
    )

    const screen = (
        <FormattedMessage
            id='SidebarTour.SearchForBoards.Body'
            defaultMessage='Open the board switcher (Cmd/Ctrl + K) to quickly search and add boards to your sidebar.'
        />
    )

    const punchout = useMeasurePunchouts(['.BoardsSwitcher'], [])

    return (
        <TourTipRenderer
            key='SearchForBoardsTourStep'
            requireCard={false}
            category={TOUR_SIDEBAR}
            step={SidebarTourSteps.SEARCH_FOR_BOARDS}
            screen={screen}
            title={title}
            punchout={punchout}
            classname='SearchForBoards'
            telemetryTag='tourPoint4d'
            placement={right}
            hideBackdrop={false}
            showForce={true}
        />
    )
}

export default SearchForBoardsTourStep
