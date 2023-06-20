// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect} from 'react'

import {FormattedMessage} from 'react-intl'

import {useMeasurePunchouts} from 'src/components/tutorial_tour_tip/hooks'

import './add_properties.scss'
import addProperty from 'static/addProperty.gif'

import {
    BaseTourSteps,
    CardTourSteps,
    TOUR_BASE,
    TOUR_CARD,
} from 'src/components/onboardingTour/index'
import TourTipRenderer from 'src/components/onboardingTour/tourTipRenderer/tourTipRenderer'
import {OnboardingBoardTitle, OnboardingCardTitle} from 'src/components/cardDetail/cardDetail'
import {useAppDispatch, useAppSelector} from 'src/store/hooks'
import {
    getMe,
    getOnboardingTourCategory,
    getOnboardingTourStarted,
    getOnboardingTourStep,
    patchProps,
} from 'src/store/users'
import {IUser, UserConfigPatch} from 'src/user'
import mutator from 'src/mutator'
import {getCurrentBoard} from 'src/store/boards'
import {getCurrentCard} from 'src/store/cards'

const AddPropertiesTourStep = (): JSX.Element | null => {
    const title = (
        <FormattedMessage
            id='OnboardingTour.AddProperties.Title'
            defaultMessage='Add properties'
        />
    )
    const screen = (
        <FormattedMessage
            id='OnboardingTour.AddProperties.Body'
            defaultMessage='Add various properties to cards to make them more powerful.'
        />
    )

    const punchout = useMeasurePunchouts(['.octo-propertyname.add-property'], [])

    const me = useAppSelector<IUser|null>(getMe)
    const dispatch = useAppDispatch()

    const board = useAppSelector(getCurrentBoard)
    const isOnboardingBoard = board ? board.title === OnboardingBoardTitle : false

    const card = useAppSelector(getCurrentCard)
    const isOnboardingCard = card ? card.title === OnboardingCardTitle : false

    const onboardingTourStarted = useAppSelector(getOnboardingTourStarted)
    const onboardingTourCategory = useAppSelector(getOnboardingTourCategory)
    const onboardingTourStep = useAppSelector(getOnboardingTourStep)

    // start the card tour if onboarding card is opened up
    // and the user is still on the base tour
    useEffect(() => {
        async function task() {
            if (!me || !card) {
                return
            }

            const should = card.id &&
                isOnboardingBoard &&
                isOnboardingCard &&
                onboardingTourStarted &&
                onboardingTourCategory === TOUR_BASE &&
                onboardingTourStep === BaseTourSteps.OPEN_A_CARD.toString()

            if (!should) {
                return
            }

            const patch: UserConfigPatch = {}
            patch.updatedFields = {}
            patch.updatedFields.tourCategory = TOUR_CARD
            patch.updatedFields.onboardingTourStep = CardTourSteps.ADD_PROPERTIES.toString()

            const updatedProps = await mutator.patchUserConfig(me.id, patch)
            if (updatedProps) {
                dispatch(patchProps(updatedProps))
            }
        }

        // this hack is needed to allow performing async task in useEffect
        task()
    }, [card])

    return (
        <TourTipRenderer
            key='AddPropertiesTourStep'
            requireCard={true}
            category={TOUR_CARD}
            step={CardTourSteps.ADD_PROPERTIES}
            screen={screen}
            title={title}
            punchout={punchout}
            classname='AddPropertiesTourStep'
            telemetryTag='tourPoint2a'
            placement={'right-end'}
            imageURL={addProperty}
            hideBackdrop={true}
        />
    )
}

export default AddPropertiesTourStep
