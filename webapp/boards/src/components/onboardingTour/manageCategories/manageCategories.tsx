// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {right} from '@popperjs/core'

import {FormattedMessage} from 'react-intl'

import {SidebarTourSteps, TOUR_SIDEBAR} from '..'

import {useMeasurePunchouts} from 'src/components/tutorial_tour_tip/hooks'

import TourTipRenderer from 'src/components/onboardingTour/tourTipRenderer/tourTipRenderer'

import {ClassForManageCategoriesTourStep} from 'src/components/sidebar/sidebarCategory'

import './manageCategories.scss'

const ManageCategoriesTourStep = (): JSX.Element | null => {
    const title = (
        <FormattedMessage
            id='SidebarTour.ManageCategories.Title'
            defaultMessage='Manage categories'
        />
    )

    const screen = (
        <FormattedMessage
            id='SidebarTour.ManageCategories.Body'
            defaultMessage='Create and manage custom categories. Categories are user-specific, so moving a board to your category won’t impact other members using the same board.'
        />
    )

    const punchout = useMeasurePunchouts([`.${ClassForManageCategoriesTourStep}`], [])

    return (
        <TourTipRenderer
            key='ManageCatergoriesTourStep'
            requireCard={false}
            category={TOUR_SIDEBAR}
            step={SidebarTourSteps.MANAGE_CATEGORIES}
            screen={screen}
            title={title}
            punchout={punchout}
            classname='ManageCatergoies'
            telemetryTag='tourPoint4b'
            placement={right}
            hideBackdrop={false}
            showForce={true}
        />
    )
}

export default ManageCategoriesTourStep
