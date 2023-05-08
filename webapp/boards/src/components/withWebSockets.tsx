// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect} from 'react'

import wsClient, {MMWebSocketClient} from 'src/wsclient'
import {Utils} from 'src/utils'

type Props = {
    userId?: string
    manifest?: {
        id: string
        version: string
    }
    webSocketClient?: MMWebSocketClient
    children: React.ReactNode
}

// WithWebSockets component initialises the websocket connection if
// it's not yet running and subscribes to the current team
const WithWebSockets = (props: Props): React.ReactElement => {
    useEffect(() => {
        // if the websocket client was already connected, do nothing
        if (wsClient.state !== 'init') {
            return
        }

        if (!props.webSocketClient) {
            Utils.logWarn('Trying to initialise Boards websocket in plugin mode without base connection. Aborting')

            return
        }

        if (!props.manifest?.id || !props.manifest?.version) {
            Utils.logError('Trying to initialise Boards websocket in plugin mode with an incomplete manifest. Aborting')

            return
        }

        wsClient.initPlugin(props.manifest?.id, props.manifest?.version, props.webSocketClient)
        wsClient.open()
    }, [props.webSocketClient])

    return (
        <>
            {props.children}
        </>
    )
}

export default WithWebSockets
