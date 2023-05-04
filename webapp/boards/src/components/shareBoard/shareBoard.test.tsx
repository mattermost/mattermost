// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {act, render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {Provider as ReduxProvider} from 'react-redux'
import thunk from 'redux-thunk'

import React from 'react'
import {MemoryRouter} from 'react-router'
import {mocked} from 'jest-mock'

import {IUser} from 'src/user'
import {ISharing} from 'src/blocks/sharing'
import {Channel} from 'src/store/channels'
import {TestBlockFactory} from 'src/test/testBlockFactory'
import {mockStateStore, wrapDNDIntl} from 'src/testUtils'
import client from 'src/octoClient'
import {Utils} from 'src/utils'

import ShareBoard from './shareBoard'

const boardId = '1'
const workspaceId: string|undefined = boardId
const viewId = boardId
const teamId = 'team-id'

jest.mock('src/octoClient')
jest.mock('src/utils')

const mockedOctoClient = mocked(client)
const mockedUtils = mocked(Utils)

let params = {}
jest.mock('react-router', () => {
    const originalModule = jest.requireActual('react-router')

    return {
        ...originalModule,
        useRouteMatch: jest.fn(() => {
            return {
                url: 'http://localhost:8065/',
                path: '/',
                params,
                isExact: true,
            }
        }),
    }
})

describe('src/components/shareBoard/shareBoard', () => {
    const w = (window as any)
    const oldBaseURL = w.baseURL

    const board = TestBlockFactory.createBoard()
    board.id = boardId
    board.teamId = teamId
    board.cardProperties = [
        {
            id: 'property1',
            name: 'Property 1',
            type: 'text',
            options: [
                {
                    id: 'value1',
                    value: 'value 1',
                    color: 'propColorBrown',
                },
            ],
        },
        {
            id: 'property2',
            name: 'Property 2',
            type: 'select',
            options: [
                {
                    id: 'value2',
                    value: 'value 2',
                    color: 'propColorBlue',
                },
            ],
        },
    ]
    board.channelId = 'channel_1'

    const activeView = TestBlockFactory.createBoardView(board)
    activeView.id = 'view1'
    activeView.fields.hiddenOptionIds = []
    activeView.fields.visiblePropertyIds = ['property1']
    activeView.fields.visibleOptionIds = ['value1']

    const fakeBoard = {id: board.id}
    activeView.boardId = fakeBoard.id

    const card1 = TestBlockFactory.createCard(board)
    card1.id = 'card1'
    card1.title = 'card-1'
    card1.boardId = fakeBoard.id

    const card2 = TestBlockFactory.createCard(board)
    card2.id = 'card2'
    card2.title = 'card-2'
    card2.boardId = fakeBoard.id

    const card3 = TestBlockFactory.createCard(board)
    card3.id = 'card3'
    card3.title = 'card-3'
    card3.boardId = fakeBoard.id

    const me: IUser = {
        id: 'user-id-1',
        username: 'username_1',
        email: '',
        nickname: '',
        firstname: '',
        lastname: '',
        props: {},
        create_at: 0,
        update_at: 0,
        is_bot: false,
        is_guest: false,
        roles: 'system_user',
    }

    const categoryAttribute1 = TestBlockFactory.createCategoryBoards()
    categoryAttribute1.name = 'Category 1'
    categoryAttribute1.boardMetadata = [{boardID: board.id, hidden: false}]

    let state: Parameters<typeof mockStateStore>[1]
    let store: ReturnType<typeof mockStateStore>

    beforeEach(() => {
        state = {
            teams: {
                current: {id: teamId, title: 'Test Team'},
            },
            users: {
                me,
                boardUsers: {[me.id]: me},
                blockSubscriptions: [],
            },
            boards: {
                current: board.id,
                boards: {
                    [board.id]: board,
                },
                templates: [],
                membersInBoards: {
                    [board.id]: {},
                },
                myBoardMemberships: {
                    [board.id]: {userId: me.id, schemeAdmin: true},
                },
            },
            globalTemplates: {
                value: [],
            },
            views: {
                views: {
                    [activeView.id]: activeView,
                },
                current: activeView.id,
            },
            cards: {
                templates: [],
                cards: [card1, card2, card3],
            },
            searchText: {},
            clientConfig: {
                value: {
                    telemetry: true,
                    telemetryid: 'telemetry',
                    enablePublicSharedBoards: true,
                    teammateNameDisplay: 'username',
                    featureFlags: {},
                },
            },
            contents: {
                contents: {},
            },
            comments: {
                comments: {},
            },
            sidebar: {
                categoryAttributes: [
                    categoryAttribute1,
                ],
            },
        }

        store = mockStateStore([thunk], state)

        // mockedUtils.buildURL.mockImplementation((path) => (w.baseURL || '') + path)

        params = {
            teamId,
            boardId,
            viewId,
            workspaceId,
        }

        mockedOctoClient.getChannel.mockResolvedValue({type: 'P', display_name: 'Dunder Mifflin Party Planing Committee'} as Channel)
    })

    afterEach(() => {
        w.baseURL = oldBaseURL
    })

    test('should match snapshot', async () => {
        const sharing: ISharing = {
            id: '',
            enabled: false,
            token: '',
        }
        mockedOctoClient.getSharing.mockResolvedValue(sharing)
        let container
        await act(async () => {
            const result = render(
                wrapDNDIntl(
                    <ReduxProvider store={store}>
                        <ShareBoard
                            onClose={jest.fn()}
                            enableSharedBoards={true}
                        />
                    </ReduxProvider>),
                {wrapper: MemoryRouter},
            )
            container = result.container
        })

        expect(container).toMatchSnapshot()
        const shareButton = screen.getByRole('button', {name: 'Share'})
        expect(shareButton).toBeDefined()
        const closeButton = screen.getByRole('button', {name: 'Close dialog'})
        expect(closeButton).toBeDefined()
    })

    test('should match snapshot with sharing', async () => {
        const sharing: ISharing = {
            id: boardId,
            enabled: true,
            token: 'oneToken',
        }
        mockedOctoClient.getSharing.mockResolvedValue(sharing)

        let container
        await act(async () => {
            const result = render(
                wrapDNDIntl(
                    <ReduxProvider store={store}>
                        <ShareBoard
                            onClose={jest.fn()}
                            enableSharedBoards={true}
                        />
                    </ReduxProvider>),
                {wrapper: MemoryRouter},
            )
            container = result.container
        })
        const copyLinkElement = screen.getByTitle('Copy link')
        expect(copyLinkElement).toBeDefined()

        expect(container).toMatchSnapshot()
    })

    test('return shareBoard and click Copy link', async () => {
        const sharing: ISharing = {
            id: boardId,
            enabled: true,
            token: 'oneToken',
        }
        mockedOctoClient.getSharing.mockResolvedValue(sharing)

        let container
        await act(async () => {
            const result = render(
                wrapDNDIntl(
                    <ReduxProvider store={store}>
                        <ShareBoard
                            onClose={jest.fn()}
                            enableSharedBoards={true}
                        />
                    </ReduxProvider>),
                {wrapper: MemoryRouter},
            )
            container = result.container
        })

        expect(container).toMatchSnapshot()

        const copyLinkElement = screen.getByTitle('Copy link')
        expect(copyLinkElement).toBeDefined()

        await act(async () => {
            await userEvent.click(copyLinkElement!)
        })

        expect(mockedUtils.copyTextToClipboard).toBeCalledTimes(1)
        expect(container).toMatchSnapshot()

        const copiedLinkElement = screen.getByText('Copied!')
        expect(copiedLinkElement).toBeDefined()
    })

    test('return shareBoard and click Regenerate token', async () => {
        window.confirm = jest.fn(() => {
            return true
        })
        const sharing: ISharing = {
            id: boardId,
            enabled: true,
            token: 'oneToken',
        }
        mockedOctoClient.getSharing.mockResolvedValue(sharing)

        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <ShareBoard
                    onClose={jest.fn()}
                    enableSharedBoards={true}
                />
            </ReduxProvider>
        ), {wrapper: MemoryRouter})

        sharing.token = 'anotherToken'
        mockedUtils.createGuid.mockReturnValue('anotherToken')
        mockedOctoClient.getSharing.mockResolvedValue(sharing)
        mockedOctoClient.setSharing.mockResolvedValue(true)

        const publishButton = screen.getByRole('button', {name: 'Publish'})
        expect(publishButton).toBeDefined()
        await act(() => userEvent.click(publishButton))

        const regenerateTokenElement = screen.getByRole('button', {name: 'Regenerate token'})
        expect(regenerateTokenElement).toBeDefined()
        await act(() => userEvent.click(regenerateTokenElement))

        expect(mockedOctoClient.setSharing).toBeCalledTimes(1)
        expect(container).toMatchSnapshot()
    })

    test('return shareBoard, and click switch', async () => {
        const sharing: ISharing = {
            id: boardId,
            enabled: true,
            token: 'oneToken',
        }
        mockedOctoClient.getSharing.mockResolvedValue(sharing)
        let container: Element | undefined
        await act(async () => {
            const result = render(
                wrapDNDIntl(
                    <ReduxProvider store={store}>
                        <ShareBoard
                            onClose={jest.fn()}
                            enableSharedBoards={true}
                        />
                    </ReduxProvider>),
                {wrapper: MemoryRouter},
            )
            container = result.container
        })

        const publishButton = screen.getByRole('button', {name: 'Publish'})
        expect(publishButton).toBeDefined()
        await userEvent.click(publishButton)

        const switchElement = container?.querySelector('.Switch')
        expect(switchElement).toBeDefined()
        await act(async () => {
            await userEvent.click(switchElement!)
        })

        expect(mockedOctoClient.setSharing).toBeCalledTimes(1)
        expect(mockedOctoClient.getSharing).toBeCalledTimes(2)
        expect(container).toMatchSnapshot()
    })

    test('return shareBoardComponent and click Switch without sharing', async () => {
        const sharing: ISharing = {
            id: '',
            enabled: false,
            token: '',
        }
        mockedOctoClient.getSharing.mockResolvedValue(sharing)
        mockedUtils.createGuid.mockReturnValue('aToken')
        const result = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <ShareBoard
                    onClose={jest.fn()}
                    enableSharedBoards={true}
                />
            </ReduxProvider>
        ), {wrapper: MemoryRouter})

        mockedOctoClient.getSharing.mockResolvedValue({
            id: boardId,
            enabled: true,
            token: 'aToken',
        })

        const publishButton = screen.getByRole('button', {name: 'Publish'})
        expect(publishButton).toBeDefined()
        await act(() => userEvent.click(publishButton))

        const switchElement = result.container?.querySelector('.Switch')
        expect(switchElement).toBeDefined()
        await act(() => userEvent.click(switchElement!))

        result.rerender(wrapDNDIntl(
            <ReduxProvider store={store}>
                <ShareBoard
                    onClose={jest.fn()}
                    enableSharedBoards={true}
                />
            </ReduxProvider>
        ))

        expect(mockedOctoClient.setSharing).toBeCalledTimes(1)
        expect(mockedOctoClient.getSharing).toBeCalledTimes(2)
        expect(result.container).toMatchSnapshot()
    })

    test('should match snapshot with sharing and subpath', async () => {
        w.baseURL = '/test-subpath/plugins/boards'
        const sharing: ISharing = {
            id: boardId,
            enabled: true,
            token: 'oneToken',
        }
        mockedOctoClient.getSharing.mockResolvedValue(sharing)
        let container
        await act(async () => {
            const result = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <ShareBoard
                        onClose={jest.fn()}
                        enableSharedBoards={true}
                    />
                </ReduxProvider>),
            {wrapper: MemoryRouter})
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })

    test('return shareBoard and click Select', async () => {
        const sharing: ISharing = {
            id: '',
            enabled: false,
            token: '',
        }
        mockedOctoClient.getSharing.mockResolvedValue(sharing)
        mockedUtils.getUserDisplayName.mockImplementation((u) => u.username)

        const users: IUser[] = [
            {id: 'userid1', username: 'username_1'} as IUser,
            {id: 'userid2', username: 'username_2'} as IUser,
            {id: 'userid3', username: 'username_3'} as IUser,
            {id: 'userid4', username: 'username_4'} as IUser,
        ]
        const channels: Channel[] = [
            {id: 'channel1', type: 'P', display_name: 'Channel 1'} as Channel,
            {id: 'channel2', type: 'P', display_name: 'Channel 2'} as Channel,
            {id: 'channel3', type: 'O', display_name: 'Channel 3'} as Channel,
            {id: 'channel4', type: 'O', display_name: 'Channel 4'} as Channel,
        ]

        mockedOctoClient.searchTeamUsers.mockResolvedValue(users)
        mockedOctoClient.searchUserChannels.mockResolvedValue(channels)

        let container
        await act(async () => {
            const result = render(
                wrapDNDIntl(
                    <ReduxProvider store={store}>
                        <ShareBoard
                            onClose={jest.fn()}
                            enableSharedBoards={false}
                        />
                    </ReduxProvider>),
                {wrapper: MemoryRouter},
            )
            container = result.container
        })

        expect(container).toMatchSnapshot()
        const selectElement = screen.getByText('Search for people and channels')
        expect(selectElement).toBeDefined()

        await act(async () => {
            await userEvent.click(selectElement!)
        })

        expect(container).toMatchSnapshot()
    })

    test('return shareBoard and click Select, non-plugin mode', async () => {
        const sharing: ISharing = {
            id: '',
            enabled: false,
            token: '',
        }
        mockedOctoClient.getSharing.mockResolvedValue(sharing)
        const users: IUser[] = [
            {id: 'userid1', username: 'username_1', permissions: ['manage_team']} as IUser,
            {id: 'userid2', username: 'username_2', permissions: ['manage_system']} as IUser,
            {id: 'userid3', username: 'username_3'} as IUser,
            {id: 'userid4', username: 'username_4'} as IUser,
        ]
        const channels: Channel[] = [
            {id: 'channel1', type: 'P', display_name: 'Channel 1'} as Channel,
            {id: 'channel2', type: 'P', display_name: 'Channel 2'} as Channel,
            {id: 'channel3', type: 'O', display_name: 'Channel 3'} as Channel,
            {id: 'channel4', type: 'O', display_name: 'Channel 4'} as Channel,
        ]

        mockedOctoClient.searchTeamUsers.mockResolvedValue(users)
        mockedOctoClient.searchUserChannels.mockResolvedValue(channels)

        let container
        await act(async () => {
            const result = render(
                wrapDNDIntl(
                    <ReduxProvider store={store}>
                        <ShareBoard
                            onClose={jest.fn()}
                            enableSharedBoards={false}
                        />
                    </ReduxProvider>),
                {wrapper: MemoryRouter},
            )
            container = result.container
        })

        expect(container).toMatchSnapshot()
        const selectElement = screen.getByText('Search for people and channels')
        expect(selectElement).toBeDefined()

        await act(async () => {
            await userEvent.click(selectElement!)
        })

        expect(container).toMatchSnapshot()
    })

    test('confirm unlinking linked channel', async () => {
        const sharing: ISharing = {
            id: '',
            enabled: false,
            token: '',
        }
        mockedOctoClient.getSharing.mockResolvedValue(sharing)

        let container: Element | DocumentFragment | null = null
        await act(async () => {
            const result = render(
                wrapDNDIntl(
                    <ReduxProvider store={store}>
                        <ShareBoard
                            onClose={jest.fn()}
                            enableSharedBoards={true}
                        />
                    </ReduxProvider>),
                {wrapper: MemoryRouter},
            )
            container = result.container
        })

        expect(container).toMatchSnapshot()

        const channelMenuBtn = container!.querySelector('.user-item.channel-item .MenuWrapper')
        expect(channelMenuBtn).not.toBeNull()
        await userEvent.click(channelMenuBtn as Element)

        const unlinkOption = screen.getByText('Unlink')
        expect(unlinkOption).not.toBeNull()
        await userEvent.click(unlinkOption)

        const unlinkConfirmationBtn = screen.getByText('Unlink channel')
        expect(unlinkConfirmationBtn).not.toBeNull()
        await userEvent.click(unlinkConfirmationBtn)

        expect(mockedOctoClient.patchBoard).toBeCalled()

        const closeButton = screen.getByRole('button', {name: 'Close dialog'})
        expect(closeButton).toBeDefined()
    })

    test('should match snapshot, with template', async () => {
        const sharing: ISharing = {
            id: '',
            enabled: false,
            token: '',
        }
        mockedOctoClient.getSharing.mockResolvedValue(sharing)

        board.isTemplate = true
        const myStore = mockStateStore([thunk], state)

        let container
        await act(async () => {
            const result = render(
                wrapDNDIntl(
                    <ReduxProvider store={myStore}>
                        <ShareBoard
                            onClose={jest.fn()}
                            enableSharedBoards={true}
                        />
                    </ReduxProvider>),
                {wrapper: MemoryRouter},
            )
            container = result.container
        })

        expect(container).toMatchSnapshot()
        const closeButton = screen.getByRole('button', {name: 'Close dialog'})
        expect(closeButton).toBeDefined()
    })

    test('return shareBoard template and click Select', async () => {
        const sharing: ISharing = {
            id: '',
            enabled: false,
            token: '',
        }
        mockedOctoClient.getSharing.mockResolvedValue(sharing)
        mockedUtils.getUserDisplayName.mockImplementation((u) => u.username)

        const users: IUser[] = [
            {id: 'userid1', username: 'username_1'} as IUser,
            {id: 'userid2', username: 'username_2'} as IUser,
            {id: 'userid3', username: 'username_3'} as IUser,
            {id: 'userid4', username: 'username_4'} as IUser,
        ]
        const channels: Channel[] = [
            {id: 'channel1', type: 'P', display_name: 'Channel 1'} as Channel,
            {id: 'channel2', type: 'P', display_name: 'Channel 2'} as Channel,
            {id: 'channel3', type: 'O', display_name: 'Channel 3'} as Channel,
            {id: 'channel4', type: 'O', display_name: 'Channel 4'} as Channel,
        ]

        mockedOctoClient.searchTeamUsers.mockResolvedValue(users)
        mockedOctoClient.searchUserChannels.mockResolvedValue(channels)

        board.isTemplate = true
        const myStore = mockStateStore([thunk], state)

        let container
        await act(async () => {
            const result = render(
                wrapDNDIntl(
                    <ReduxProvider store={myStore}>
                        <ShareBoard
                            onClose={jest.fn()}
                            enableSharedBoards={false}
                        />
                    </ReduxProvider>),
                {wrapper: MemoryRouter},
            )
            container = result.container
        })

        expect(container).toMatchSnapshot()
        const selectElement = screen.getByText('Search for people')
        expect(selectElement).toBeDefined()

        await act(() => userEvent.click(selectElement!))

        expect(mockedOctoClient.searchUserChannels).not.toBeCalled()
        expect(container).toMatchSnapshot()
    })
})
