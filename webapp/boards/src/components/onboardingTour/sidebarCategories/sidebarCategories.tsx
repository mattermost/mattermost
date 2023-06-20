// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect} from 'react'

import {right} from '@popperjs/core'

import {FormattedMessage} from 'react-intl'

import {useMeasurePunchouts} from 'src/components/tutorial_tour_tip/hooks'
import TourTipRenderer from 'src/components/onboardingTour/tourTipRenderer/tourTipRenderer'
import {
    FINISHED,
    SidebarTourSteps,
    TOUR_BOARD,
    TOUR_SIDEBAR,
} from 'src/components/onboardingTour/index'
import {useAppDispatch, useAppSelector} from 'src/store/hooks'
import {
    getMe,
    getOnboardingTourCategory,
    getOnboardingTourStep,
    patchProps,
} from 'src/store/users'
import {IUser, UserConfigPatch} from 'src/user'
import mutator from 'src/mutator'
import {Constants} from 'src/constants'

import './sidebarCategories.scss'

const SidebarCategoriesTourStep = (): JSX.Element | null => {
    const title = (
        <FormattedMessage
            id='SidebarTour.SidebarCategories.Title'
            defaultMessage='Sidebar categories'
        />
    )
    const screen = (
        <div>
            <FormattedMessage
                id='SidebarTour.SidebarCategories.Body'
                defaultMessage='All your boards are now organized under your new sidebar. No more switching between workspaces. One-time custom categories based on your prior workspaces may have automatically been created for you as part of your v7.2 upgrade. These can be removed or edited to your preference. '
            />
            <a
                href='https://docs.mattermost.com/welcome/whats-new-in-v72.html'
                target='_blank'
                rel='noopener noreferrer'
            >
                <FormattedMessage
                    id='SidebarTour.SidebarCategories.Link'
                    defaultMessage='Learn more'
                />
            </a>
        </div>
    )

    const punchout = useMeasurePunchouts(['.SidebarCategory'], [])

    const me = useAppSelector<IUser|null>(getMe)
    const dispatch = useAppDispatch()
    const onboardingTourCategory = useAppSelector(getOnboardingTourCategory)
    const onboardingTourStep = useAppSelector(getOnboardingTourStep)

    useEffect(() => {
        async function task() {
            if (!me) {
                return
            }

            const should = onboardingTourCategory === TOUR_BOARD &&
                           onboardingTourStep === FINISHED.toString()

            if (!should) {
                return
            }

            const patch: UserConfigPatch = {}
            patch.updatedFields = {}
            patch.updatedFields.tourCategory = TOUR_SIDEBAR
            patch.updatedFields.onboardingTourStep = SidebarTourSteps.SIDE_BAR.toString()
            patch.updatedFields.lastWelcomeVersion = Constants.versionString

            const updatedProps = await mutator.patchUserConfig(me.id, patch)
            if (updatedProps) {
                dispatch(patchProps(updatedProps))
            }
        }

        // this hack is needed to allow performing async task in useEffect
        task()
    }, [])

    return (
        <TourTipRenderer
            key='SidebardCategoriesTourStep'
            requireCard={false}
            category={TOUR_SIDEBAR}
            step={SidebarTourSteps.SIDE_BAR}
            screen={screen}
            title={title}
            punchout={punchout}
            classname='SidebarCategories'
            telemetryTag='tourPoint4a'
            placement={right}
            hideBackdrop={false}
            showForce={true}
        />
    )
}

export default SidebarCategoriesTourStep
