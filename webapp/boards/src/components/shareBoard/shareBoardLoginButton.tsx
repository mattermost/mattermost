// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react'
import {FormattedMessage} from 'react-intl'
import {generatePath, useRouteMatch} from 'react-router-dom'

import Button from 'src/widgets/buttons/button'
import TelemetryClient, {TelemetryActions, TelemetryCategory} from 'src/telemetry/telemetryClient'

import './shareBoardLoginButton.scss'

const ShareBoardLoginButton = () => {
    const match = useRouteMatch<{teamId: string, boardId: string, viewId?: string, cardId?: string}>()

    // Mattermost login doesn't respect the redirect query parameter
    // if the user is already logged in, so we send the user to the
    // board and if they are not logged in, the webapp will take care
    // of the redirection
    const baseURL = window.location.href.split('/boards/public')[0]
    const loginPath = `${baseURL}/${generatePath('/boards/team/:teamId/:boardId?/:viewId?/:cardId?', match.params)}`

    const onLoginClick = useCallback(() => {
        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.ShareBoardLogin)
        location.assign(loginPath)
    }, [])

    return (
        <div className='ShareBoardLoginButton'>
            <Button
                title='Login'
                size='medium'
                emphasis='primary'
                onClick={() => onLoginClick()}
            >
                <FormattedMessage
                    id='CenterPanel.Login'
                    defaultMessage='Login'
                />
            </Button>
        </div>
    )
}

export default React.memo(ShareBoardLoginButton)
