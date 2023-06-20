// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {FormattedMessage} from 'react-intl'

import {useHistory, useLocation} from 'react-router-dom'

import BoardWelcomePNG from 'static/boards-welcome.png'
import BoardWelcomeSmallPNG from 'static/boards-welcome-small.png'

import Button from 'src/widgets/buttons/button'
import CompassIcon from 'src/widgets/icons/compassIcon'

import './welcomePage.scss'
import mutator from 'src/mutator'
import {useAppDispatch, useAppSelector} from 'src/store/hooks'
import {IUser, UserConfigPatch} from 'src/user'
import {
    fetchMe,
    getMe,
    getMyConfig,
    patchProps,
} from 'src/store/users'
import {Team, getCurrentTeam} from 'src/store/teams'
import octoClient from 'src/octoClient'
import {FINISHED, TOUR_ORDER} from 'src/components/onboardingTour'
import TelemetryClient, {TelemetryActions, TelemetryCategory} from 'src/telemetry/telemetryClient'
import {UserSettingKey} from 'src/userSettings'

const WelcomePage = () => {
    const history = useHistory()
    const queryString = new URLSearchParams(useLocation().search)
    const me = useAppSelector<IUser|null>(getMe)
    const myConfig = useAppSelector(getMyConfig)
    const currentTeam = useAppSelector<Team|null>(getCurrentTeam)
    const dispatch = useAppDispatch()

    const setWelcomePageViewed = async (userID: string): Promise<any> => {
        const patch: UserConfigPatch = {}
        patch.updatedFields = {}
        patch.updatedFields[UserSettingKey.WelcomePageViewed] = '1'

        const updatedProps = await mutator.patchUserConfig(userID, patch)
        if (updatedProps) {
            return dispatch(patchProps(updatedProps))
        }

        return Promise.resolve()
    }

    const goForward = () => {
        if (queryString.get('r')) {
            history.replace(queryString.get('r')!)

            return
        }
        if (currentTeam) {
            history.replace(`/team/${currentTeam?.id}`)
        } else {
            history.replace('/')
        }
    }

    const skipTour = async () => {
        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.SkipTour)

        if (me) {
            await setWelcomePageViewed(me.id)
            const patch: UserConfigPatch = {
                updatedFields: {
                    tourCategory: TOUR_ORDER[TOUR_ORDER.length - 1],
                    onboardingTourStep: FINISHED.toString(),
                },
            }

            const patchedProps = await octoClient.patchUserConfig(me.id, patch)
            if (patchedProps) {
                await dispatch(patchProps(patchedProps))
            }
        }

        goForward()
    }

    const startTour = async () => {
        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.StartTour)

        if (!me) {
            return
        }
        if (!currentTeam) {
            return
        }

        await setWelcomePageViewed(me.id)
        const onboardingData = await octoClient.prepareOnboarding(currentTeam.id)
        await dispatch(fetchMe())
        const newPath = `/team/${onboardingData?.teamID}/${onboardingData?.boardID}`
        history.replace(newPath)
    }

    // It's still possible for a guest to end up at this route/page directly, so
    // let's mark it as viewed, if necessary, and route them forward
    if (me?.is_guest) {
        if (!myConfig[UserSettingKey.WelcomePageViewed]) {
            (async () => {
                await setWelcomePageViewed(me.id)
            })()
        }
        goForward()

        return null
    }

    if (myConfig[UserSettingKey.WelcomePageViewed]) {
        goForward()

        return null
    }

    return (
        <div className='WelcomePage'>
            <div className='wrapper'>
                <h1 className='text-heading9'>
                    <FormattedMessage
                        id='WelcomePage.Heading'
                        defaultMessage='Welcome To Boards'
                    />
                </h1>
                <div className='WelcomePage__subtitle'>
                    <FormattedMessage
                        id='WelcomePage.Description'
                        defaultMessage='Boards is a project management tool that helps define, organize, track, and manage work across teams using a familiar Kanban board view.'
                    />
                </div>

                <div className='WelcomePage__content'>
                    {/* This image will be rendered on large screens over 2000px */}
                    <img
                        src={BoardWelcomePNG}
                        className='WelcomePage__image WelcomePage__image--large'
                        alt='Boards Welcome Image'
                    />

                    {/* This image will be rendered on small screens below 2000px */}
                    <img
                        src={BoardWelcomeSmallPNG}
                        className='WelcomePage__image WelcomePage__image--small'
                        alt='Boards Welcome Image'
                    />

                    <div className='WelcomePage__buttons'>
                        {me?.is_guest !== true &&
                        <Button
                            onClick={startTour}
                            filled={true}
                            size='large'
                            icon={
                                <CompassIcon
                                    icon='chevron-right'
                                    className='Icon Icon--right'
                                />}
                            rightIcon={true}
                        >
                            <FormattedMessage
                                id='WelcomePage.Explore.Button'
                                defaultMessage='Take a tour'
                            />
                        </Button>}

                        {me?.is_guest !== true &&
                        <a
                            className='skip'
                            onClick={skipTour}
                        >
                            <FormattedMessage
                                id='WelcomePage.NoThanks.Text'
                                defaultMessage="No thanks, I'll figure it out myself"
                            />
                        </a>}
                        {me?.is_guest === true &&
                        <Button
                            onClick={skipTour}
                            filled={true}
                            size='large'
                        >
                            <FormattedMessage
                                id='WelcomePage.StartUsingIt.Text'
                                defaultMessage='Start using it'
                            />
                        </Button>}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default React.memo(WelcomePage)
