// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {FormattedMessage} from 'react-intl'

import {useMeasurePunchouts} from 'src/components/tutorial_tour_tip/hooks'

import './add_comments.scss'
import addComment from 'static/comment.gif'

import {CardTourSteps, TOUR_CARD} from 'src/components/onboardingTour/index'
import TourTipRenderer from 'src/components/onboardingTour/tourTipRenderer/tourTipRenderer'

const AddCommentTourStep = (): JSX.Element | null => {
    const title = (
        <FormattedMessage
            id='OnboardingTour.AddComments.Title'
            defaultMessage='Add comments'
        />
    )
    const screen = (
        <FormattedMessage
            id='OnboardingTour.AddComments.Body'
            defaultMessage='You can comment on issues, and even @mention your fellow Mattermost users to get their attention.'
        />
    )

    const punchout = useMeasurePunchouts(['.CommentsList__new'], [])

    return (
        <TourTipRenderer
            key='AddCommentTourStep'
            requireCard={true}
            category={TOUR_CARD}
            step={CardTourSteps.ADD_COMMENTS}
            screen={screen}
            title={title}
            punchout={punchout}
            classname='AddCommentTourStep'
            telemetryTag='tourPoint2b'
            placement={'right-end'}
            imageURL={addComment}
            hideBackdrop={true}
        />
    )
}

export default AddCommentTourStep
