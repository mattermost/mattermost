// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect, useMemo} from 'react'
import {
    Router,
    Redirect,
    Switch,
    useRouteMatch,
    useHistory,
    generatePath,
    useLocation,
} from 'react-router-dom'
import {createBrowserHistory, History} from 'history'

import {IAppWindow} from './types'
import BoardPage from './pages/boardPage/boardPage'
import WelcomePage from './pages/welcome/welcomePage'
import ErrorPage from './pages/errorPage'
import {Utils} from './utils'
import octoClient from './octoClient'
import {setGlobalError, getGlobalError} from './store/globalError'
import {useAppSelector, useAppDispatch} from './store/hooks'
import {getFirstTeam, fetchTeams, Team} from './store/teams'
import {UserSettings} from './userSettings'
import FBRoute from './route'

declare let window: IAppWindow

function HomeToCurrentTeam(props: {path: string, exact: boolean}) {
    return (
        <FBRoute
            path={props.path}
            exact={props.exact}
            loginRequired={true}
            component={() => {
                const firstTeam = useAppSelector<Team|null>(getFirstTeam)
                const dispatch = useAppDispatch()
                useEffect(() => {
                    dispatch(fetchTeams())
                }, [])

                let teamID = (window.getCurrentTeamId && window.getCurrentTeamId()) || ''
                const lastTeamID = UserSettings.lastTeamId
                if (!teamID && !firstTeam && !lastTeamID) {
                    return <></>
                }
                teamID = teamID || lastTeamID || firstTeam?.id || ''

                if (UserSettings.lastBoardId) {
                    const lastBoardID = UserSettings.lastBoardId[teamID]
                    const lastViewID = UserSettings.lastViewId[lastBoardID]

                    if (lastBoardID && lastViewID) {
                        return <Redirect to={`/team/${teamID}/${lastBoardID}/${lastViewID}`}/>
                    }
                    if (lastBoardID) {
                        return <Redirect to={`/team/${teamID}/${lastBoardID}`}/>
                    }
                }

                return <Redirect to={`/team/${teamID}`}/>
            }}
        />
    )
}

function WorkspaceToTeamRedirect() {
    const match = useRouteMatch<{boardId: string, viewId: string, cardId?: string, workspaceId?: string}>()
    const queryParams = new URLSearchParams(useLocation().search)
    const history = useHistory()
    useEffect(() => {
        octoClient.getBoard(match.params.boardId).then((board) => {
            if (board) {
                let newPath = generatePath(match.path.replace('/workspace/:workspaceId', '/team/:teamId'), {
                    teamId: board?.teamId,
                    boardId: board?.id,
                    viewId: match.params.viewId,
                    cardId: match.params.cardId,
                })
                if (queryParams) {
                    newPath += '?' + queryParams
                }
                history.replace(newPath)
            }
        })
    }, [])
    return null
}

function GlobalErrorRedirect() {
    const globalError = useAppSelector<string>(getGlobalError)
    const dispatch = useAppDispatch()
    const history = useHistory()

    useEffect(() => {
        if (globalError) {
            dispatch(setGlobalError(''))
            history.replace(`/error?id=${globalError}`)
        }
    }, [globalError, history])

    return null
}

type Props = {
    history?: History<unknown>
}

const FocalboardRouter = (props: Props): JSX.Element => {
    let browserHistory: History<unknown>
    if (props.history) {
        browserHistory = props.history
    } else {
        browserHistory = useMemo(() => {
            return createBrowserHistory({basename: Utils.getFrontendBaseURL()})
        }, [])
    }

    useEffect(() => {
        if (window.frontendBaseURL) {
            browserHistory.replace(window.location.pathname.replace(window.frontendBaseURL, ''))
        }
    }, [])

    return (
        <Router history={browserHistory}>
            <GlobalErrorRedirect/>
            <Switch>
                <HomeToCurrentTeam
                    path='/'
                    exact={true}
                />
                <FBRoute
                    exact={true}
                    path='/welcome'
                >
                    <WelcomePage/>
                </FBRoute>
                <FBRoute path='/error'>
                    <ErrorPage/>
                </FBRoute>
                <FBRoute path={['/team/:teamId/new/:channelId']}>
                    <BoardPage new={true}/>
                </FBRoute>

                <FBRoute path={['/team/:teamId/shared/:boardId?/:viewId?/:cardId?', '/shared/:boardId?/:viewId?/:cardId?']}>
                    <BoardPage readonly={true}/>
                </FBRoute>

                <FBRoute
                    loginRequired={true}
                    path='/board/:boardId?/:viewId?/:cardId?'
                    getOriginalPath={({params: {boardId, viewId, cardId}}) => {
                        return `/board/${Utils.buildOriginalPath('', boardId, viewId, cardId)}`
                    }}
                >
                    <BoardPage/>
                </FBRoute>
                <FBRoute path={['/workspace/:workspaceId/shared/:boardId?/:viewId?/:cardId?', '/workspace/:workspaceId/:boardId?/:viewId?/:cardId?']}>
                    <WorkspaceToTeamRedirect/>
                </FBRoute>
                <FBRoute
                    loginRequired={true}
                    path='/team/:teamId/:boardId?/:viewId?/:cardId?'
                    getOriginalPath={({params: {teamId, boardId, viewId, cardId}}) => {
                        return `/team/${Utils.buildOriginalPath(teamId, boardId, viewId, cardId)}`
                    }}
                >
                    <BoardPage/>
                </FBRoute>
            </Switch>
        </Router>
    )
}

export default React.memo(FocalboardRouter)
