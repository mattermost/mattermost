// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect} from 'react'
import {DndProvider} from 'react-dnd'
import {HTML5Backend} from 'react-dnd-html5-backend'
import {TouchBackend} from 'react-dnd-touch-backend'
import {History} from 'history'

import TelemetryClient from './telemetry/telemetryClient'

import FlashMessages from './components/flashMessages'
import NewVersionBanner from './components/newVersionBanner'
import {Utils} from './utils'
import {fetchMe, getMe} from './store/users'
import {useAppDispatch, useAppSelector} from './store/hooks'
import {fetchClientConfig} from './store/clientConfig'
import FocalboardRouter from './router'

import {IUser} from './user'

type Props = {
    history?: History<unknown>
}

const App = (props: Props): JSX.Element => {
    const me = useAppSelector<IUser|null>(getMe)
    const dispatch = useAppDispatch()

    useEffect(() => {
        dispatch(fetchMe())
        dispatch(fetchClientConfig())
    }, [])

    useEffect(() => {
        if (me) {
            TelemetryClient.setUser(me)
        }
    }, [me])

    return (
        <DndProvider backend={Utils.isMobile() ? TouchBackend : HTML5Backend}>
            <FlashMessages milliseconds={2000}/>
            <div id='frame'>
                <div id='main'>
                    <NewVersionBanner/>
                    <FocalboardRouter history={props.history}/>
                </div>
            </div>
        </DndProvider>
    )
}

export default React.memo(App)
