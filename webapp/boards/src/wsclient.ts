// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ClientConfig} from './config/clientConfig'

import {CategoryOrder, Utils, WSMessagePayloads} from './utils'
import {Block} from './blocks/block'
import {Board, BoardMember} from './blocks/board'
import {OctoUtils} from './octoUtils'
import {BoardCategoryWebsocketData, Category} from './store/sidebar'

// These are outgoing commands to the server
type WSCommand = {
    action: string
    teamId?: string
    readToken?: string
    blockIds?: string[]
}

// These are messages from the server
export type WSMessage = {
    action?: string
    block?: Block
    board?: Board
    category?: Category
    blockCategories?: BoardCategoryWebsocketData[]
    error?: string
    teamId?: string
    member?: BoardMember
    timestamp?: number
    categoryOrder?: string[]
}

export const ACTION_UPDATE_BOARD = 'UPDATE_BOARD'
export const ACTION_UPDATE_MEMBER = 'UPDATE_MEMBER'
export const ACTION_DELETE_MEMBER = 'DELETE_MEMBER'
export const ACTION_UPDATE_BLOCK = 'UPDATE_BLOCK'
export const ACTION_AUTH = 'AUTH'
export const ACTION_SUBSCRIBE_BLOCKS = 'SUBSCRIBE_BLOCKS'
export const ACTION_SUBSCRIBE_TEAM = 'SUBSCRIBE_TEAM'
export const ACTION_UNSUBSCRIBE_TEAM = 'UNSUBSCRIBE_TEAM'
export const ACTION_UNSUBSCRIBE_BLOCKS = 'UNSUBSCRIBE_BLOCKS'
export const ACTION_UPDATE_CLIENT_CONFIG = 'UPDATE_CLIENT_CONFIG'
export const ACTION_UPDATE_CATEGORY = 'UPDATE_CATEGORY'
export const ACTION_UPDATE_BOARD_CATEGORY = 'UPDATE_BOARD_CATEGORY'
export const ACTION_UPDATE_SUBSCRIPTION = 'UPDATE_SUBSCRIPTION'
export const ACTION_UPDATE_CARD_LIMIT_TIMESTAMP = 'UPDATE_CARD_LIMIT_TIMESTAMP'
export const ACTION_REORDER_CATEGORIES = 'REORDER_CATEGORIES'

type WSSubscriptionMsg = {
    action?: string
    subscription?: Subscription
    error?: string
}

export interface Subscription {
    blockId: string
    subscriberId: string
    blockType: string
    subscriberType: string
    notifiedAt?: number
    createAt?: number
    deleteAt?: number
}

// The Mattermost websocket client interface
export interface MMWebSocketClient {
    conn: WebSocket | null
    sendMessage(action: string, data: any, responseCallback?: () => void): void /* eslint-disable-line @typescript-eslint/no-explicit-any */
    addFirstConnectListener(callback: () => void): void
    addReconnectListener(callback: () => void): void
    addErrorListener(callback: (event: Event) => void): void
    addCloseListener(callback: (connectFailCount: number) => void): void
}

type OnChangeHandler = (client: WSClient, items: any[]) => void
type OnReconnectHandler = (client: WSClient) => void
type OnStateChangeHandler = (client: WSClient, state: 'init' | 'open' | 'close') => void
type OnErrorHandler = (client: WSClient, e: Event) => void
type OnConfigChangeHandler = (client: WSClient, clientConfig: ClientConfig) => void
type OnCardLimitTimestampChangeHandler = (client: WSClient, timestamp: number) => void
type FollowChangeHandler = (client: WSClient, subscription: Subscription) => void

export type ChangeHandlerType = 'block' | 'category' | 'blockCategories' | 'board' | 'boardMembers' | 'categoryOrder'

type UpdatedData = {
    Blocks: Block[]
    Categories: Category[]
    BoardCategories: BoardCategoryWebsocketData[]
    Boards: Board[]
    BoardMembers: BoardMember[]
    CategoryOrder: string[]
}

type ChangeHandlers = {
    Block: OnChangeHandler[]
    Category: OnChangeHandler[]
    BoardCategory: OnChangeHandler[]
    Board: OnChangeHandler[]
    BoardMember: OnChangeHandler[]
    CategoryReorder: OnChangeHandler[]
}

type Subscriptions = {
    Teams: Record<string, number>
}

class WSClient {
    client: MMWebSocketClient|null = null
    onPluginReconnect: null|(() => void) = null
    token = ''
    pluginId = ''
    pluginVersion = ''
    teamId = ''
    onAppVersionChangeHandler: ((versionHasChanged: boolean) => void) | null = null
    clientPrefix = ''
    serverUrl: string | undefined
    state: 'init'|'open'|'close' = 'init'
    onStateChange: OnStateChangeHandler[] = []
    onReconnect: OnReconnectHandler[] = []
    onChange: ChangeHandlers = {Block: [], Category: [], BoardCategory: [], Board: [], BoardMember: [], CategoryReorder: []}
    onError: OnErrorHandler[] = []
    onConfigChange: OnConfigChangeHandler[] = []
    onCardLimitTimestampChange: OnCardLimitTimestampChangeHandler[] = []
    onFollowBlock: FollowChangeHandler = () => {}
    onUnfollowBlock: FollowChangeHandler = () => {}
    private notificationDelay = 100
    private reopenDelay = 3000
    private updatedData: UpdatedData = {Blocks: [], Categories: [], BoardCategories: [], Boards: [], BoardMembers: [], CategoryOrder: []}
    private updateTimeout?: NodeJS.Timeout
    private errorPollId?: NodeJS.Timeout
    private subscriptions: Subscriptions = {Teams: {}}

    private logged = false

    // this need to be a function rather than a const because
    // one of the global variable (`window.baseURL`) is set at runtime
    // after the first instance of OctoClient is created.
    // Avoiding the race condition becomes more complex than making
    // the base URL dynamic though a function
    private getBaseURL(): string {
        const baseURL = (this.serverUrl || Utils.getBaseURL(true)).replace(/\/$/, '')

        // Logging this for debugging.
        // Logging just once to avoid log noise.
        if (!this.logged) {
            Utils.log(`WSClient serverUrl: ${baseURL}`)
            this.logged = true
        }

        return baseURL
    }

    constructor(serverUrl?: string) {
        this.serverUrl = serverUrl
    }

    initPlugin(pluginId: string, pluginVersion: string, client: MMWebSocketClient): void {
        this.pluginId = pluginId
        this.pluginVersion = pluginVersion
        this.clientPrefix = `custom_${pluginId}_`
        this.client = client
        Utils.log(`WSClient initialised for plugin id "${pluginId}"`)
    }

    resetSubscriptions() {
        this.subscriptions = {Teams: {}} as Subscriptions
    }

    // this function sends the necessary commands for the connection
    // to subscribe to all registered subscriptions
    subscribe() {
        Utils.log('Sending commands for the registered subscriptions')
        Object.keys(this.subscriptions.Teams).forEach((teamId) => this.sendSubscribeToTeamCommand(teamId))
    }

    sendCommand(command: WSCommand): void {
        try {
            if (this.client !== null) {
                const {action, ...data} = command
                this.client.sendMessage(this.clientPrefix + action, data)
            }
        } catch (e) {
            Utils.logError(`WSClient failed to send command ${command.action}: ${e}`)
        }
    }

    sendAuthenticationCommand(token: string): void {
        const command = {action: ACTION_AUTH, token}

        this.sendCommand(command)
    }

    sendSubscribeToTeamCommand(teamId: string): void {
        const command: WSCommand = {
            action: ACTION_SUBSCRIBE_TEAM,
            teamId,
        }

        this.sendCommand(command)
    }

    sendUnsubscribeToTeamCommand(teamId: string): void {
        const command: WSCommand = {
            action: ACTION_UNSUBSCRIBE_TEAM,
            teamId,
        }

        this.sendCommand(command)
    }

    addOnChange(handler: OnChangeHandler, type: ChangeHandlerType): void {
        switch (type) {
        case 'block':
            this.onChange.Block.push(handler)
            break
        case 'category':
            this.onChange.Category.push(handler)
            break
        case 'blockCategories':
            this.onChange.BoardCategory.push(handler)
            break
        case 'board':
            this.onChange.Board.push(handler)
            break
        case 'boardMembers':
            this.onChange.BoardMember.push(handler)
            break
        case 'categoryOrder':
            this.onChange.CategoryReorder.push(handler)
            break
        }
    }

    removeOnChange(needle: OnChangeHandler, type: ChangeHandlerType): void {
        let haystack = []
        switch (type) {
        case 'block':
            haystack = this.onChange.Block
            break
        case 'blockCategories':
            haystack = this.onChange.BoardCategory
            break
        case 'board':
            haystack = this.onChange.Board
            break
        case 'boardMembers':
            haystack = this.onChange.BoardMember
            break
        case 'category':
            haystack = this.onChange.Category
            break
        case 'categoryOrder':
            haystack = this.onChange.CategoryReorder
            break
        }

        if (!haystack) {
            return
        }

        const index = haystack.indexOf(needle)
        if (index !== -1) {
            haystack.splice(index, 1)
        }
    }

    addOnReconnect(handler: OnReconnectHandler): void {
        this.onReconnect.push(handler)
    }

    removeOnReconnect(handler: OnReconnectHandler): void {
        const index = this.onReconnect.indexOf(handler)
        if (index !== -1) {
            this.onReconnect.splice(index, 1)
        }
    }

    addOnStateChange(handler: OnStateChangeHandler): void {
        this.onStateChange.push(handler)
    }

    removeOnStateChange(handler: OnStateChangeHandler): void {
        const index = this.onStateChange.indexOf(handler)
        if (index !== -1) {
            this.onStateChange.splice(index, 1)
        }
    }

    addOnError(handler: OnErrorHandler): void {
        this.onError.push(handler)
    }

    removeOnError(handler: OnErrorHandler): void {
        const index = this.onError.indexOf(handler)
        if (index !== -1) {
            this.onError.splice(index, 1)
        }
    }

    addOnConfigChange(handler: OnConfigChangeHandler): void {
        this.onConfigChange.push(handler)
    }

    removeOnConfigChange(handler: OnConfigChangeHandler): void {
        const index = this.onConfigChange.indexOf(handler)
        if (index !== -1) {
            this.onConfigChange.splice(index, 1)
        }
    }

    addOnCardLimitTimestampChange(handler: OnCardLimitTimestampChangeHandler): void {
        this.onCardLimitTimestampChange.push(handler)
    }

    removeOnCardLimitTimestampChange(handler: OnCardLimitTimestampChangeHandler): void {
        const index = this.onCardLimitTimestampChange.indexOf(handler)
        if (index !== -1) {
            this.onCardLimitTimestampChange.splice(index, 1)
        }
    }

    open(): void {
        if (this.client !== null) {
            // configure the Mattermost websocket client callbacks
            const onConnect = () => {
                Utils.log('WSClient in plugin mode, reusing Mattermost WS connection')

                // if there are any subscriptions set by the
                // components, send their subscribe messages
                this.subscribe()

                for (const handler of this.onStateChange) {
                    handler(this, 'open')
                }
                this.state = 'open'
            }

            const onReconnect = () => {
                Utils.logWarn('WSClient reconnected')

                onConnect()
                for (const handler of this.onReconnect) {
                    handler(this)
                }
            }
            this.onPluginReconnect = onReconnect

            const onClose = (connectFailCount: number) => {
                Utils.logError(`WSClient has been closed, connect fail count: ${connectFailCount}`)

                for (const handler of this.onStateChange) {
                    handler(this, 'close')
                }
                this.state = 'close'

                // there is no way to react to a reconnection with the
                // reliable websockets schema, so we poll the raw
                // websockets client for its state directly until it
                // reconnects
                if (!this.errorPollId) {
                    this.errorPollId = setInterval(() => {
                        Utils.logWarn(`Polling websockets connection for state: ${this.client?.conn?.readyState}`)
                        if (this.client?.conn?.readyState === 1) {
                            onReconnect()
                            clearInterval(this.errorPollId!)
                            this.errorPollId = undefined
                        }
                    }, 500)
                }
            }

            const onError = (event: Event) => {
                Utils.logError(`WSClient websocket onerror. data: ${JSON.stringify(event)}`)

                for (const handler of this.onError) {
                    handler(this, event)
                }
            }

            this.client.addFirstConnectListener(onConnect)
            this.client.addErrorListener(onError)
            this.client.addCloseListener(onClose)
            this.client.addReconnectListener(onReconnect)
        }
    }

    hasConn(): boolean {
        return this.client !== null
    }

    updateHandler(message: WSMessage): void {
        // if messages are directed to a team, process only the ones
        // for the current team
        if (message.teamId && message.teamId !== this.teamId) {
            return
        }

        const [data, type] = Utils.fixWSData(message)
        if (data) {
            this.queueUpdateNotification(data, type)
        }
    }

    setOnFollowBlock(handler: FollowChangeHandler): void {
        this.onFollowBlock = handler
    }

    setOnUnfollowBlock(handler: FollowChangeHandler): void {
        this.onUnfollowBlock = handler
    }

    updateClientConfigHandler(config: ClientConfig): void {
        for (const handler of this.onConfigChange) {
            handler(this, config)
        }
    }

    updateCardLimitTimestampHandler(action: {action: string, timestamp: number}): void {
        for (const handler of this.onCardLimitTimestampChange) {
            handler(this, action.timestamp)
        }
    }

    updateSubscriptionHandler(message: WSSubscriptionMsg): void {
        Utils.log('updateSubscriptionHandler: ' + message.action + '; blockId=' + message.subscription?.blockId)

        if (!message.subscription) {
            return
        }

        const handler = message.subscription.deleteAt ? this.onUnfollowBlock : this.onFollowBlock
        handler(this, message.subscription)
    }

    setOnAppVersionChangeHandler(fn: (versionHasChanged: boolean) => void): void {
        this.onAppVersionChangeHandler = fn
    }

    pluginStatusesChangedHandler(data: any): void {
        if (this.pluginId === '' || !this.onAppVersionChangeHandler) {
            return
        }

        const focalboardStatusChange = data.plugin_statuses.find((s: any) => s.plugin_id === this.pluginId)
        if (focalboardStatusChange) {
            // if the plugin version is greater than the current one,
            // show the new version banner
            if (Utils.compareVersions(this.pluginVersion, focalboardStatusChange.version) > 0) {
                Utils.log('Boards plugin has been updated')
                this.onAppVersionChangeHandler(true)
            }

            // if the plugin version is greater or equal, trigger a
            // reconnect to resubscribe in case the interface hasn't
            // been reloaded
            if (Utils.compareVersions(this.pluginVersion, focalboardStatusChange.version) >= 0) {
                // this is a temporal solution that leaves a second
                // between the message and the reconnect so the server
                // has time to register the WS handler
                setTimeout(() => {
                    if (this.onPluginReconnect) {
                        Utils.log('Reconnecting after plugin update')
                        this.onPluginReconnect()
                    }
                }, 1000)
            }
        }
    }

    authenticate(token: string): void {
        if (!token) {
            Utils.assertFailure('WSClient trying to authenticate without a token')

            return
        }

        if (this.hasConn()) {
            this.sendAuthenticationCommand(token)
        }

        this.token = token
    }

    subscribeToTeam(teamId: string): void {
        if (!this.subscriptions.Teams[teamId]) {
            Utils.log(`First component subscribing to team ${teamId}`)

            // only send command if the WS connection has already been
            // stablished. If not, the connect or reconnect functions
            // will do
            if (this.hasConn()) {
                this.sendSubscribeToTeamCommand(teamId)
            }

            this.teamId = teamId
            this.subscriptions.Teams[teamId] = 1

            return
        }

        this.subscriptions.Teams[teamId] += 1
    }

    unsubscribeToTeam(teamId: string): void {
        if (!this.subscriptions.Teams[teamId]) {
            Utils.logError('Component trying to unsubscribe to a team when no subscriptions are registered. Doing nothing')

            return
        }

        this.subscriptions.Teams[teamId] -= 1
        if (this.subscriptions.Teams[teamId] === 0) {
            Utils.log(`Last subscription to team ${teamId} being removed`)
            if (this.hasConn()) {
                this.sendUnsubscribeToTeamCommand(teamId)
            }

            if (teamId === this.teamId) {
                this.teamId = ''
            }
            delete this.subscriptions.Teams[teamId]
        }
    }

    subscribeToBlocks(teamId: string, blockIds: string[], readToken = ''): void {
        if (!this.hasConn()) {
            Utils.assertFailure('WSClient.subscribeToBlocks: ws is not open')

            return
        }

        const command: WSCommand = {
            action: ACTION_SUBSCRIBE_BLOCKS,
            blockIds,
            teamId,
            readToken,
        }

        this.sendCommand(command)
    }

    unsubscribeFromBlocks(teamId: string, blockIds: string[], readToken = ''): void {
        if (!this.hasConn()) {
            Utils.assertFailure('WSClient.removeBlocks: ws is not open')

            return
        }

        const command: WSCommand = {
            action: ACTION_UNSUBSCRIBE_BLOCKS,
            blockIds,
            teamId,
            readToken,
        }

        this.sendCommand(command)
    }

    private queueUpdateNotification(data: WSMessagePayloads, type: ChangeHandlerType) {
        if (!data) {
            return
        }

        // Remove existing queued update
        if (type === 'block') {
            this.updatedData.Blocks = this.updatedData.Blocks.filter((o) => o.id !== (data as Block).id)
            this.updatedData.Blocks.push(OctoUtils.hydrateBlock(data as Block))
        } else if (type === 'category') {
            this.updatedData.Categories = this.updatedData.Categories.filter((c) => c.id !== (data as Category).id)
            this.updatedData.Categories.push(data as Category)
        } else if (type === 'blockCategories') {
            this.updatedData.BoardCategories = this.updatedData.BoardCategories.filter((b) => !(data as BoardCategoryWebsocketData[]).find((boardCategory) => boardCategory.boardID === b.boardID))
            this.updatedData.BoardCategories.push(...(data as BoardCategoryWebsocketData[]))
        } else if (type === 'board') {
            this.updatedData.Boards = this.updatedData.Boards.filter((b) => b.id !== (data as Board).id)
            this.updatedData.Boards.push(data as Board)
        } else if (type === 'boardMembers') {
            this.updatedData.BoardMembers = this.updatedData.BoardMembers.filter((m) => m.userId !== (data as BoardMember).userId || m.boardId !== (data as BoardMember).boardId)
            this.updatedData.BoardMembers.push(data as BoardMember)
        } else if (type === 'categoryOrder') {
            // Since each update contains the whole state of all
            // categories, we don't need to keep accumulating all updates.
            // Only the very latest one is sufficient to describe the
            // latest state of all sidebar categories.
            this.updatedData.CategoryOrder = (data as CategoryOrder)
        }

        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout)
            this.updateTimeout = undefined
        }

        this.updateTimeout = setTimeout(() => {
            this.flushUpdateNotifications()
        }, this.notificationDelay)
    }

    private logUpdateNotification() {
        for (const block of this.updatedData.Blocks) {
            Utils.log(`WSClient flush update block: ${block.id}`)
        }

        for (const category of this.updatedData.Categories) {
            Utils.log(`WSClient flush update category: ${category.id}`)
        }

        for (const blockCategories of this.updatedData.BoardCategories) {
            Utils.log(`WSClient flush update blockCategory: ${blockCategories.boardID} ${blockCategories.categoryID}`)
        }

        for (const board of this.updatedData.Boards) {
            Utils.log(`WSClient flush update board: ${board.id}`)
        }

        for (const boardMember of this.updatedData.BoardMembers) {
            Utils.log(`WSClient flush update boardMember: ${boardMember.userId} ${boardMember.boardId}`)
        }

        Utils.log(`WSClient flush update categoryOrder: ${this.updatedData.CategoryOrder}`)
    }

    private flushUpdateNotifications() {
        this.logUpdateNotification()

        for (const handler of this.onChange.Block) {
            handler(this, this.updatedData.Blocks)
        }

        for (const handler of this.onChange.Category) {
            handler(this, this.updatedData.Categories)
        }

        for (const handler of this.onChange.BoardCategory) {
            handler(this, this.updatedData.BoardCategories)
        }

        for (const handler of this.onChange.Board) {
            handler(this, this.updatedData.Boards)
        }

        for (const handler of this.onChange.BoardMember) {
            handler(this, this.updatedData.BoardMembers)
        }

        for (const handler of this.onChange.CategoryReorder) {
            handler(this, this.updatedData.CategoryOrder)
        }

        this.updatedData = {
            Blocks: [],
            Categories: [],
            BoardCategories: [],
            Boards: [],
            BoardMembers: [],
            CategoryOrder: [],
        }
    }

    close(): void {
        if (!this.hasConn()) {
            return
        }

        // Use this sequence so the onclose method doesn't try to re-open
        this.onChange = {Block: [], Category: [], BoardCategory: [], Board: [], BoardMember: [], CategoryReorder: []}
        this.onReconnect = []
        this.onStateChange = []
        this.onError = []
    }
}

const wsClient = new WSClient()

export {WSClient}
export default wsClient
