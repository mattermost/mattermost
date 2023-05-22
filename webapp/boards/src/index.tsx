// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect} from 'react'
import {FormattedMessage} from 'react-intl'
import {Action, Store} from 'redux'
import {Provider as ReduxProvider} from 'react-redux'
import {History, createBrowserHistory} from 'history'

import {GlobalState} from '@mattermost/types/store'

import {SuiteWindow} from 'src/types/index'

import {PluginRegistry} from 'src/types/mattermost-webapp'

import {ServiceEnvironment} from '@mattermost/types/config'

import {RudderTelemetryHandler, rudderAnalytics} from 'src/rudder'

import appBarIcon from 'static/app-bar-icon.png'

import {Constants} from 'src/constants'

import {setTeam} from 'src/store/teams'

import {UserSettings} from 'src/userSettings'
import {getMessages} from 'src/i18n'

const windowAny = (window as SuiteWindow)
windowAny.baseURL = '/plugins/boards'
windowAny.frontendBaseURL = '/boards'

import App from 'src/app'
import PublicApp, {publicBaseURL} from 'src/public/app'

import store from 'src/store'
import WithWebSockets from 'src/components/withWebSockets'
import {setChannel} from 'src/store/channels'
import {initialLoad} from 'src/store/initialLoad'
import {Utils} from 'src/utils'
import GlobalHeader from 'src/components/globalHeader/globalHeader'
import FocalboardIcon from 'src/widgets/icons/logo'
import {setMattermostTheme} from 'src/theme'

import TelemetryClient, {TelemetryActions, TelemetryCategory} from 'src/telemetry/telemetryClient'

import 'styles/focalboard-variables.scss'
import 'styles/main.scss'
import 'styles/labels.scss'
import octoClient from 'src/octoClient'

import {Board} from 'src/blocks/board'

import BoardsUnfurl from 'src/components/boardsUnfurl/boardsUnfurl'

import wsClient, {
    ACTION_REORDER_CATEGORIES,
    ACTION_UPDATE_BLOCK,
    ACTION_UPDATE_BOARD,
    ACTION_UPDATE_BOARD_CATEGORY,
    ACTION_UPDATE_CARD_LIMIT_TIMESTAMP,
    ACTION_UPDATE_CATEGORY,
    ACTION_UPDATE_CLIENT_CONFIG,
    ACTION_UPDATE_SUBSCRIPTION,
    MMWebSocketClient,
} from 'src/wsclient'

import ErrorBoundary from 'src/components/error_boundary'

import RHSChannelBoards from 'src/components/rhsChannelBoards'
import RHSChannelBoardsHeader from 'src/components/rhsChannelBoardsHeader'
import BoardSelector from 'src/./components/boardSelector'

import manifest from 'src/manifest'

import './plugin.scss'
import CreateBoardFromTemplate from 'src/components/createBoardFromTemplate'

import CloudUpgradeNudge from './components/cloudUpgradeNudge/cloudUpgradeNudge'
import RhsChannelBoardsToggle from './components/rhsChannelBoardsToggleIcon'

function getSubpath(siteURL: string): string {
    const url = new URL(siteURL)

    // remove trailing slashes
    return url.pathname.replace(/\/+$/, '')
}

const TELEMETRY_RUDDER_URL = 'https://pdat.matterlytics.com'
const TELEMETRY_RUDDER_KEY_PROD = '1myWcDbTkIThnpPYyms7DKlmQWl'
const TELEMETRY_RUDDER_KEY_TEST = '1myWYwHRDFdLDTpznQ7qFlOPQaa'

// TO_BE_DEPRECATED_* are placeholders to allow the existing release pipelines to run without
// failing to insert the values that are now hard-coded above. Remove this once we converge
// on the unified delivery pipeline in GitHub.
//
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TO_BE_DEPRECATED_TELEMETRY_RUDDER_URL = 'placeholder_rudder_dataplane_url'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TO_BE_DEPRECATAED_TELEMETRY_RUDDER_KEY = 'placeholder_boards_rudder_key'

const TELEMETRY_OPTIONS = {
    context: {
        ip: '0.0.0.0',
    },
    page: {
        path: '',
        referrer: '',
        search: '',
        title: '',
        url: '',
    },
    anonymousId: '00000000000000000000000000',
}

type Props = {
    webSocketClient: MMWebSocketClient
}

function customHistory() {
    const history = createBrowserHistory({basename: Utils.getFrontendBaseURL()})

    if (Utils.isDesktop()) {
        window.addEventListener('message', (event: MessageEvent) => {
            if (event.origin !== windowAny.location.origin) {
                return
            }

            const pathName = event.data.message?.pathName
            if (!pathName || !pathName.startsWith('/boards')) {
                return
            }

            Utils.log(`Navigating Boards to ${pathName}`)
            history.replace(pathName.replace('/boards', ''))
        })
    }

    return {
        ...history,
        push: (path: string, state?: unknown) => {
            if (Utils.isDesktop()) {
                windowAny.postMessage(
                    {
                        type: 'browser-history-push',
                        message: {
                            path: `${windowAny.frontendBaseURL}${path}`,
                        },
                    },
                    windowAny.location.origin,
                )
            } else {
                history.push(path, state as Record<string, never>)
            }
        },
    }
}

let browserHistory: History<unknown>

const MainApp = (props: Props) => {
    useEffect(() => {
        document.body.classList.add('focalboard-body')
        document.body.classList.add('app__body')
        const root = document.getElementById('root')
        if (root) {
            root.classList.add('focalboard-plugin-root')
        }

        return () => {
            document.body.classList.remove('focalboard-body')
            document.body.classList.remove('app__body')
            if (root) {
                root.classList.remove('focalboard-plugin-root')
            }
        }
    }, [])

    return (
        <ErrorBoundary>
            <ReduxProvider store={store}>
                <WithWebSockets
                    manifest={manifest}
                    webSocketClient={props.webSocketClient}
                >
                    <div id='focalboard-app'>
                        <App history={browserHistory}/>
                    </div>
                    <div id='focalboard-root-portal'/>
                </WithWebSockets>
            </ReduxProvider>
        </ErrorBoundary>
    )
}

const PublicMainApp = () => {
    useEffect(() => {
        document.body.classList.add('focalboard-body')
        const root = document.getElementById('root')
        if (root) {
            while (root.firstElementChild) {
                if (root.firstElementChild.id === 'focalboard-app') {
                    break
                }
                root.removeChild(root.firstElementChild)
            }
            root.classList.add('focalboard-plugin-root')
        }

        return () => {
            document.body.classList.remove('focalboard-body')
            if (root) {
                root.classList.remove('focalboard-plugin-root')
            }
        }
    }, [])

    return (
        <ErrorBoundary>
            <ReduxProvider store={store}>
                <div id='focalboard-app'>
                    <PublicApp/>
                </div>
                <div id='focalboard-root-portal'/>
            </ReduxProvider>
        </ErrorBoundary>
    )
}

const HeaderComponent = () => {
    return (
        <ErrorBoundary>
            <GlobalHeader history={browserHistory}/>
        </ErrorBoundary>
    )
}

export default class Plugin {
    channelHeaderButtonId?: string
    rhsId?: string
    boardSelectorId?: string
    registry?: PluginRegistry

    async initialize(registry: PluginRegistry, mmStore: Store<GlobalState, Action<Record<string, unknown>>>): Promise<void> {
        const siteURL = mmStore.getState().entities.general.config.SiteURL
        const subpath = siteURL ? getSubpath(siteURL) : ''
        windowAny.frontendBaseURL = subpath + windowAny.frontendBaseURL
        windowAny.baseURL = subpath + windowAny.baseURL
        browserHistory = customHistory()

        this.registry = registry

        UserSettings.nameFormat = mmStore.getState().entities.preferences?.myPreferences['display_settings--name_format']?.value || null
        let theme = mmStore.getState().entities.preferences.myPreferences.theme
        setMattermostTheme(theme)

        const productID = 'boards'

        registry.registerTranslations((locale: string) => {
            try {
                const messages = getMessages(locale)

                return messages
            } catch {
                return {}
            }
        })

        // register websocket handlers
        this.registry?.registerWebSocketEventHandler(`custom_${productID}_${ACTION_UPDATE_BOARD}`, (e: any) => wsClient.updateHandler(e.data))
        this.registry?.registerWebSocketEventHandler(`custom_${productID}_${ACTION_UPDATE_CATEGORY}`, (e: any) => wsClient.updateHandler(e.data))
        this.registry?.registerWebSocketEventHandler(`custom_${productID}_${ACTION_UPDATE_BOARD_CATEGORY}`, (e: any) => wsClient.updateHandler(e.data))
        this.registry?.registerWebSocketEventHandler(`custom_${productID}_${ACTION_UPDATE_CLIENT_CONFIG}`, (e: any) => wsClient.updateClientConfigHandler(e.data))
        this.registry?.registerWebSocketEventHandler(`custom_${productID}_${ACTION_UPDATE_CARD_LIMIT_TIMESTAMP}`, (e: any) => wsClient.updateCardLimitTimestampHandler(e.data))
        this.registry?.registerWebSocketEventHandler(`custom_${productID}_${ACTION_UPDATE_SUBSCRIPTION}`, (e: any) => wsClient.updateSubscriptionHandler(e.data))
        this.registry?.registerWebSocketEventHandler(`custom_${productID}_${ACTION_REORDER_CATEGORIES}`, (e: any) => wsClient.updateHandler(e.data))

        this.registry?.registerWebSocketEventHandler('plugin_statuses_changed', (e: any) => wsClient.pluginStatusesChangedHandler(e.data))
        this.registry?.registerPostTypeComponent('custom_cloud_upgrade_nudge', CloudUpgradeNudge)
        this.registry?.registerWebSocketEventHandler('preferences_changed', (e: any) => {
            let preferences
            try {
                preferences = JSON.parse(e.data.preferences)
            } catch {
                preferences = []
            }
            if (preferences) {
                for (const preference of preferences) {
                    if (preference.category === 'theme' && theme !== preference.value) {
                        setMattermostTheme(JSON.parse(preference.value))
                        theme = preference.value
                    }
                    if (preference.category === 'display_settings' && preference.name === 'name_format') {
                        UserSettings.nameFormat = preference.value
                    }
                }
            }
        })

        const initCurrentChannelId = mmStore.getState().entities.channels.currentChannelId
        const initCurrentChannel = mmStore.getState().entities.channels.channels[initCurrentChannelId]
        let lastViewedChannelId = initCurrentChannelId
        let prevTeamId: string
        store.dispatch(setChannel(initCurrentChannel))

        mmStore.subscribe(() => {
            const {users: {currentUserId}, channels: {currentChannelId}} = mmStore.getState().entities

            if (lastViewedChannelId !== currentChannelId && currentChannelId) {
                localStorage.setItem('focalboardLastViewedChannel:' + currentUserId, currentChannelId)
                lastViewedChannelId = currentChannelId
                octoClient.channelId = currentChannelId
                const currentChannelObj = mmStore.getState().entities.channels.channels[lastViewedChannelId]
                store.dispatch(setChannel(currentChannelObj))
            }

            // Watch for change in active team.
            // This handles the user selecting a team from the team sidebar.
            const {teams: {currentTeamId}} = mmStore.getState().entities
            if (currentTeamId && currentTeamId !== prevTeamId) {
                if (prevTeamId && window.location.pathname.startsWith(windowAny.frontendBaseURL || '')) {
                    // Don't re-push the URL if we're already on a URL for the current team
                    if (!window.location.pathname.startsWith(`${(windowAny.frontendBaseURL || '')}/team/${currentTeamId}`)) {
                        browserHistory.push(`/team/${currentTeamId}`)
                    }
                }
                prevTeamId = currentTeamId
                store.dispatch(setTeam(currentTeamId))
                octoClient.teamId = currentTeamId
                if (!window.location.pathname.includes(publicBaseURL())) {
                    store.dispatch(initialLoad())
                }
            }

            if (currentTeamId && currentTeamId !== prevTeamId) {
                let t = mmStore.getState().entities.preferences.myPreferences[`theme--${currentTeamId}`]
                if (!t) {
                    t = mmStore.getState().entities.preferences.myPreferences['theme--'] || mmStore.getState().entities.preferences.myPreferences.theme
                }
                setMattermostTheme(t)
            }
        })

        let fbPrevTeamID = store.getState().teams.currentId
        store.subscribe(() => {
            const currentTeamID: string = store.getState().teams.currentId
            const currentUserId = mmStore.getState().entities.users.currentUserId
            if (currentTeamID !== fbPrevTeamID) {
                fbPrevTeamID = currentTeamID

                mmStore.dispatch({
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    type: 'SELECT_TEAM',
                    data: currentTeamID,
                })
                localStorage.setItem(`user_prev_team:${currentUserId}`, currentTeamID)
            }
        })

        if (this.registry.registerProduct) {
            windowAny.frontendBaseURL = subpath + '/boards'

            const component = (props: {webSocketClient: MMWebSocketClient}) => (
                <ReduxProvider store={store}>
                    <WithWebSockets
                        manifest={manifest}
                        webSocketClient={props.webSocketClient}
                    >
                        <RHSChannelBoards/>
                    </WithWebSockets>
                </ReduxProvider>
            )

            const title = (
                <ErrorBoundary>
                    <ReduxProvider store={store}>
                        <RHSChannelBoardsHeader/>
                    </ReduxProvider>
                </ErrorBoundary>
            )

            const {id, toggleRHSPlugin} = this.registry.registerRightHandSidebarComponent(component, title)
            this.rhsId = id

            this.channelHeaderButtonId = registry.registerChannelHeaderButtonAction(
                () => <RhsChannelBoardsToggle boardsRhsId={id}/>,
                () => mmStore.dispatch(toggleRHSPlugin),
                'Boards',
                'Boards'
            )

            this.registry.registerProduct(
                '/boards',
                'product-boards',
                'Boards',
                '/boards',
                MainApp,
                HeaderComponent,
                () => null,
                true,
                true,
                true,
                PublicMainApp,
            )

            const goToFocalboardTemplate = () => {
                const currentTeam = mmStore.getState().entities.teams.currentTeamId
                const currentChannel = mmStore.getState().entities.channels.currentChannelId
                TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.ClickChannelIntro, {teamID: currentTeam})
                window.open(`${windowAny.frontendBaseURL}/team/${currentTeam}/new/${currentChannel}`, '_blank', 'noopener')
            }

            if (registry.registerChannelIntroButtonAction) {
                this.channelHeaderButtonId = registry.registerChannelIntroButtonAction(
                    <FocalboardIcon/>,
                    goToFocalboardTemplate,
                    <FormattedMessage
                        id='ChannelIntro.CreateBoard'
                        defaultMessage='Create a board'
                    />
                )
            }

            if (this.registry.registerAppBarComponent) {
                this.registry.registerAppBarComponent(
                    appBarIcon,
                    () => mmStore.dispatch(toggleRHSPlugin),
                    <FormattedMessage
                        id='AppBar.Tooltip'
                        defaultMessage='Toggle linked boards'
                    />
                )
            }

            if (this.registry.registerActionAfterChannelCreation) {
                this.registry.registerActionAfterChannelCreation((props: {
                    setCanCreate: (canCreate: boolean) => void
                    setAction: (fn: () => (channelId: string, teamId: string) => Promise<Board | undefined>) => void
                    newBoardInfoIcon: React.ReactNode
                }) => (
                    <ReduxProvider store={store}>
                        <CreateBoardFromTemplate
                            setCanCreate={props.setCanCreate}
                            setAction={props.setAction}
                            newBoardInfoIcon={props.newBoardInfoIcon}
                        />
                    </ReduxProvider>
                ))
            }

            this.registry.registerPostWillRenderEmbedComponent(
                (embed) => embed.type === 'boards',
                (props: {embed: {data: string}, webSocketClient: MMWebSocketClient}) => (
                    <ReduxProvider store={store}>
                        <BoardsUnfurl
                            embed={props.embed}
                            webSocketClient={props.webSocketClient}
                        />
                    </ReduxProvider>
                ),
                false
            )

            // Insights handler
            if (this.registry?.registerInsightsHandler) {
                this.registry?.registerInsightsHandler(async (timeRange: string, page: number, perPage: number, teamId: string, insightType: string) => {
                    if (insightType === Constants.myInsights) {
                        const data = await octoClient.getMyTopBoards(timeRange, page, perPage, teamId)

                        return data
                    }

                    const data = await octoClient.getTeamTopBoards(timeRange, page, perPage, teamId)

                    return data
                })
            }

            // Site statistics handler
            if (registry.registerSiteStatisticsHandler) {
                registry.registerSiteStatisticsHandler(async () => {
                    const siteStats = await octoClient.getSiteStatistics()
                    if (siteStats) {
                        return {
                            boards_count: {
                                name: (
                                    <FormattedMessage
                                        id='SiteStats.total_boards'
                                        defaultMessage='Total boards'
                                    />
                                ),
                                id: 'total_boards',
                                icon: 'icon-product-boards',
                                value: siteStats.board_count,
                            },
                            cards_count: {
                                name: (
                                    <FormattedMessage
                                        id='SiteStats.total_cards'
                                        defaultMessage='Total cards'
                                    />
                                ),
                                id: 'total_cards',
                                icon: 'icon-products',
                                value: siteStats.card_count,
                            },
                        }
                    }

                    return {}
                })
            }
        }

        this.boardSelectorId = this.registry.registerRootComponent((props: {webSocketClient: MMWebSocketClient}) => (
            <ReduxProvider store={store}>
                <WithWebSockets
                    manifest={manifest}
                    webSocketClient={props.webSocketClient}
                >
                    <BoardSelector/>
                </WithWebSockets>
            </ReduxProvider>
        ))

        const config = await octoClient.getClientConfig()
        if (config?.telemetry) {
            const rudderUrl = TELEMETRY_RUDDER_URL
            let rudderKey = ''
            switch (mmStore.getState().entities.general.config.ServiceEnvironment) {
            case ServiceEnvironment.ENTERPRISE:
            case ServiceEnvironment.CLOUD:
                rudderKey = TELEMETRY_RUDDER_KEY_PROD
                break
            case ServiceEnvironment.TEST:
                rudderKey = TELEMETRY_RUDDER_KEY_TEST
                break
            case ServiceEnvironment.DEV:
                break
            }

            if (rudderKey !== '') {
                const rudderCfg = {} as {setCookieDomain: string}
                if (siteURL && siteURL !== '') {
                    try {
                        rudderCfg.setCookieDomain = new URL(siteURL).hostname
                        // eslint-disable-next-line no-empty
                    } catch (_) {}
                }
                rudderAnalytics.load(rudderKey, rudderUrl, rudderCfg)

                rudderAnalytics.identify(config?.telemetryid, {}, TELEMETRY_OPTIONS)

                rudderAnalytics.page('BoardsLoaded', '',
                    TELEMETRY_OPTIONS.page,
                    {
                        context: TELEMETRY_OPTIONS.context,
                        anonymousId: TELEMETRY_OPTIONS.anonymousId,
                    })

                rudderAnalytics.ready(() => {
                    TelemetryClient.setTelemetryHandler(new RudderTelemetryHandler())
                })
            }
        }

        windowAny.getCurrentTeamId = (): string => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            return mmStore.getState().entities.teams.currentTeamId
        }
    }

    uninitialize(): void {
        if (this.channelHeaderButtonId) {
            this.registry?.unregisterComponent(this.channelHeaderButtonId)
        }
        if (this.rhsId) {
            this.registry?.unregisterComponent(this.rhsId)
        }
        if (this.boardSelectorId) {
            this.registry?.unregisterComponent(this.boardSelectorId)
        }

        // unregister websocket handlers
        this.registry?.unregisterWebSocketEventHandler(wsClient.clientPrefix + ACTION_UPDATE_BLOCK)
    }
}
