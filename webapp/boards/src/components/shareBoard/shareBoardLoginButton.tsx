// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react'
import {FormattedMessage} from 'react-intl'
import {generatePath, useRouteMatch, useHistory} from 'react-router-dom'

import Button from 'src/widgets/buttons/button'
import TelemetryClient, {TelemetryActions, TelemetryCategory} from 'src/telemetry/telemetryClient'

import './shareBoardLoginButton.scss'

const ShareBoardLoginButton = () => {
    const match = useRouteMatch<{teamId: string, boardId: string, viewId?: string, cardId?: string}>()
    const history = useHistory()

    const redirectQueryParam = 'r=' + encodeURIComponent(generatePath('/:boardId?/:viewId?/:cardId?', match.params))
    const loginPath = '/login?' + redirectQueryParam

    const onLoginClick = useCallback(() => {
        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.ShareBoardLogin)
        history.push(loginPath)
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
