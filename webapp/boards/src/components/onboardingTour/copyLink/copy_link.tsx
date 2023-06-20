// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {FormattedMessage} from 'react-intl'

import {useMeasurePunchouts} from 'src/components/tutorial_tour_tip/hooks'

import './copy_link.scss'
import copyLink from 'static/copyLink.gif'

import {BoardTourSteps, TOUR_BOARD} from 'src/components/onboardingTour/index'
import {OnboardingCardClassName} from 'src/components/kanban/kanbanCard'
import TourTipRenderer from 'src/components/onboardingTour/tourTipRenderer/tourTipRenderer'

const CopyLinkTourStep = (): JSX.Element | null => {
    const title = (
        <FormattedMessage
            id='OnboardingTour.CopyLink.Title'
            defaultMessage='Copy link'
        />
    )
    const screen = (
        <FormattedMessage
            id='OnboardingTour.CopyLink.Body'
            defaultMessage='You can share your cards with teammates by copying the link and pasting it in a channel, direct message, or group message.'
        />
    )

    const punchout = useMeasurePunchouts([`.${OnboardingCardClassName} .optionsMenu`], [])

    return (
        <TourTipRenderer
            key='CopyLinkTourStep'
            requireCard={false}
            category={TOUR_BOARD}
            step={BoardTourSteps.COPY_LINK}
            screen={screen}
            title={title}
            punchout={punchout}
            classname='CopyLinkTourStep'
            telemetryTag='tourPoint3b'
            placement={'right-start'}
            imageURL={copyLink}
            hideBackdrop={true}
        />
    )
}

export default CopyLinkTourStep
