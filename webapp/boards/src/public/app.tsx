// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {Router, Switch} from 'react-router-dom'

import {DndProvider} from 'react-dnd'
import {HTML5Backend} from 'react-dnd-html5-backend'
import {TouchBackend} from 'react-dnd-touch-backend'
import {createBrowserHistory} from 'history'

import BoardPage from 'src/pages/boardPage/boardPage'
import FBRoute from 'src/route'

import FlashMessages from 'src/components/flashMessages'
import NewVersionBanner from 'src/components/newVersionBanner'
import {Utils} from 'src/utils'

export const publicBaseURL = () => {
    return Utils.getFrontendBaseURL() + '/public'
}

const PublicRouter = () => {
    const history = createBrowserHistory({basename: publicBaseURL()})

    return (
        <Router history={history}>
            <Switch>
                <FBRoute path={['/team/:teamId/shared/:boardId?/:viewId?/:cardId?', '/shared/:boardId?/:viewId?/:cardId?']}>
                    <BoardPage readonly={true}/>
                </FBRoute>
            </Switch>
        </Router>
    )
}

const PublicApp = (): JSX.Element => {
    return (
        <DndProvider backend={Utils.isMobile() ? TouchBackend : HTML5Backend}>
            <FlashMessages milliseconds={2000}/>
            <div id='frame'>
                <div id='main'>
                    <NewVersionBanner/>
                    <PublicRouter/>
                </div>
            </div>
        </DndProvider>
    )
}

export default React.memo(PublicApp)
