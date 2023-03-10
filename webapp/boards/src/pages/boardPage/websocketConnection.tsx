// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect, useState} from 'react'
import {FormattedMessage} from 'react-intl'

import wsClient, {WSClient} from 'src/wsclient'
import {useAppSelector} from 'src/store/hooks'

import {getMe} from 'src/store/users'
import {IUser} from 'src/user'

const websocketTimeoutForBanner = 5000

// WebsocketConnection component checks the websockets client for
// state changes and if the connection is closed, shows a banner
// indicating that there has been a connection error
const WebsocketConnection = () => {
    const [websocketClosed, setWebsocketClosed] = useState(false)
    const me = useAppSelector<IUser|null>(getMe)

    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>
        const updateWebsocketState = (_: WSClient, newState: 'init'|'open'|'close'): void => {
            if (timeout) {
                clearTimeout(timeout)
            }

            if (newState === 'close') {
                timeout = setTimeout(() => {
                    setWebsocketClosed(true)
                }, websocketTimeoutForBanner)
            } else {
                setWebsocketClosed(false)
            }
        }

        wsClient.addOnStateChange(updateWebsocketState)

        return () => {
            if (timeout) {
                clearTimeout(timeout)
            }
            wsClient.removeOnStateChange(updateWebsocketState)
        }
    }, [me?.id])

    if (websocketClosed) {
        return (
            <div className='WSConnection error'>
                <a
                    href='https://www.focalboard.com/fwlink/websocket-connect-error.html'
                    target='_blank'
                    rel='noreferrer'
                >
                    <FormattedMessage
                        id='Error.websocket-closed'
                        defaultMessage='Websocket connection closed, connection interrupted. If this persists, check your server or web proxy configuration.'
                    />
                </a>
            </div>
        )
    }

    return null
}

export default WebsocketConnection
