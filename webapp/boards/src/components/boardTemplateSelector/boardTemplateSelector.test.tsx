// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {
    render,
    screen,
    act,
    waitFor,
    within
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import {MockStoreEnhanced} from 'redux-mock-store'
import {createMemoryHistory} from 'history'

import {mocked} from 'jest-mock'

import {Provider as ReduxProvider} from 'react-redux'

import {MemoryRouter, Router} from 'react-router-dom'

import Mutator from 'src/mutator'
import {Team} from 'src/store/teams'
import {createBoard, Board} from 'src/blocks/board'
import {IUser} from 'src/user'
import {mockDOM, mockStateStore, wrapDNDIntl} from 'src/testUtils'

import client from 'src/octoClient'

import TelemetryClient from 'src/telemetry/telemetryClient'

import BoardTemplateSelector from './boardTemplateSelector'

jest.mock('react-router-dom', () => {
    const originalModule = jest.requireActual('react-router-dom')

    return {
        ...originalModule,
        useRouteMatch: jest.fn(() => {
            return {url: '/'}
        }),
    }
})
jest.mock('src/octoClient', () => {
    return {
        getAllBlocks: jest.fn(() => Promise.resolve([])),
        patchUserConfig: jest.fn(() => Promise.resolve({})),
    }
})
jest.mock('src/mutator')
jest.mock('src/utils')

jest.mock('src/telemetry/telemetryClient')
const mockedTelemetry = mocked(TelemetryClient, true)

describe('components/boardTemplateSelector/boardTemplateSelector', () => {
    const mockedMutator = mocked(Mutator, true)
    const mockedOctoClient = mocked(client, true)
    const team1: Team = {
        id: 'team-1',
        title: 'Team 1',
        signupToken: '',
        updateAt: 0,
        modifiedBy: 'user-1',
    }
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
    const template1Title = 'Template 1'
    const globalTemplateTitle = 'Template Global'
    const boardTitle = 'Board 1'
    let store: MockStoreEnhanced<unknown, unknown>
    beforeAll(mockDOM)
    beforeEach(() => {
        jest.clearAllMocks()
        const state = {
            teams: {
                current: team1,
            },
            users: {
                me,
                boardUsers: {[me.id]: me},
            },
            boards: {
                boards: [
                    {
                        id: '2',
                        title: boardTitle,
                        teamId: team1.id,
                        icon: '🚴🏻‍♂️',
                        cardProperties: [
                            {id: 'id-6'},
                        ],
                        dateDisplayPropertyId: 'id-6',
                    },
                ],
                templates: [
                    {
                        id: '1',
                        teamId: team1.id,
                        title: template1Title,
                        icon: '🚴🏻‍♂️',
                        cardProperties: [
                            {id: 'id-5'},
                        ],
                        dateDisplayPropertyId: 'id-5',
                    },
                    {
                        id: '2',
                        teamId: '0',
                        title: 'Welcome to Boards!',
                        icon: '❄️',
                        cardProperties: [
                            {id: 'id-5'},
                        ],
                        dateDisplayPropertyId: 'id-5',
                        properties: {
                            trackingTemplateId: 'template_id_2',
                        },
                        createdBy: 'system',
                    },
                ],
                membersInBoards: {
                    1: {userId: me.id, schemeAdmin: true},
                    2: {userId: me.id, schemeAdmin: true},
                },
                myBoardMemberships: {
                    1: {userId: me.id, schemeAdmin: true},
                    2: {userId: me.id, schemeAdmin: true},
                },
                cards: [],
                views: [],
            },
            globalTemplates: {
                value: [{
                    id: 'global-1',
                    title: globalTemplateTitle,
                    teamId: '0',
                    icon: '🚴🏻‍♂️',
                    cardProperties: [
                        {id: 'global-id-5'},
                    ],
                    dateDisplayPropertyId: 'global-id-5',
                    isTemplate: true,
                    templateVersion: 2,
                    properties: {
                        trackingTemplateId: 'template_id_global',
                    },
                    createdBy: 'system',
                }],
            },
        }
        store = mockStateStore([], state)
        jest.useRealTimers()
    })
    describe('a focalboard Plugin', () => {
        test('should match snapshot', () => {
            const {container} = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <BoardTemplateSelector onClose={jest.fn()}/>
                </ReduxProvider>
                ,
            ), {wrapper: MemoryRouter})
            expect(container).toMatchSnapshot()
        })
        test('should match snapshot without close', () => {
            const {container} = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <BoardTemplateSelector/>
                </ReduxProvider>
                ,
            ), {wrapper: MemoryRouter})
            expect(container).toMatchSnapshot()
        })
        test('should match snapshot with custom title and description', () => {
            const {container} = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <BoardTemplateSelector
                        title='test-title'
                        description='test-description'
                    />
                </ReduxProvider>
                ,
            ), {wrapper: MemoryRouter})
            expect(container).toMatchSnapshot()
        })
        test('return BoardTemplateSelector and click close call the onClose callback', () => {
            const onClose = jest.fn()
            const {container} = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <BoardTemplateSelector onClose={onClose}/>
                </ReduxProvider>
                ,
            ), {wrapper: MemoryRouter})
            const divCloseButton = container.querySelector('div.toolbar .CloseIcon')
            expect(divCloseButton).not.toBeNull()
            userEvent.click(divCloseButton!)
            expect(onClose).toBeCalledTimes(1)
        })
        test('return BoardTemplateSelector and click new template', () => {
            render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <BoardTemplateSelector onClose={jest.fn()}/>
                </ReduxProvider>
                ,
            ), {wrapper: MemoryRouter})
            const divNewTemplate = screen.getByText('Create new template').parentElement
            expect(divNewTemplate).not.toBeNull()
            userEvent.click(divNewTemplate!)
            expect(mockedMutator.addEmptyBoardTemplate).toBeCalledTimes(1)
        })
        test('return BoardTemplateSelector and click empty board', async () => {
            const newBoard = createBoard({id: 'new-board'} as Board)
            mockedMutator.addEmptyBoard.mockResolvedValue({boards: [newBoard], blocks: []})

            render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <BoardTemplateSelector onClose={jest.fn()}/>
                </ReduxProvider>
                ,
            ), {wrapper: MemoryRouter})

            const divEmptyboard = screen.getByText('Create empty board').parentElement
            expect(divEmptyboard).not.toBeNull()
            userEvent.click(divEmptyboard!)
            expect(mockedMutator.addEmptyBoard).toBeCalledTimes(1)
            await waitFor(() => expect(mockedMutator.updateBoard).toBeCalledWith(newBoard, newBoard, 'linked channel'))
        })
        test('return BoardTemplateSelector and click delete template icon', async () => {
            const root = document.createElement('div')
            root.setAttribute('id', 'focalboard-root-portal')
            render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <BoardTemplateSelector onClose={jest.fn()}/>
                </ReduxProvider>
                ,
            ), {wrapper: MemoryRouter, container: document.body.appendChild(root)})
            const deleteIcon = screen.getByText(template1Title).parentElement?.querySelector('.DeleteIcon')
            expect(deleteIcon).not.toBeNull()
            act(() => {
                userEvent.click(deleteIcon!)
            })

            const {getByText} = within(root)
            const deleteConfirm = getByText('Delete')
            expect(deleteConfirm).not.toBeNull()

            await act(async () => {
                await userEvent.click(deleteConfirm!)
            })

            expect(mockedMutator.deleteBoard).toBeCalledTimes(1)
        })
        test('return BoardTemplateSelector and click edit template icon', async () => {
            const history = createMemoryHistory()
            history.push = jest.fn()
            render(wrapDNDIntl(
                <Router history={history}>
                    <ReduxProvider store={store}>
                        <BoardTemplateSelector onClose={jest.fn()}/>
                    </ReduxProvider>
                </Router>,
            ))
            const editIcon = screen.getByText(template1Title).parentElement?.querySelector('.EditIcon')
            expect(editIcon).not.toBeNull()
            userEvent.click(editIcon!)
        })
        test('return BoardTemplateSelector and click to add board from template', async () => {
            const newBoard = createBoard({id: 'new-board'} as Board)
            mockedMutator.addBoardFromTemplate.mockResolvedValue({boards: [newBoard], blocks: []})

            render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <BoardTemplateSelector onClose={jest.fn()}/>
                </ReduxProvider>
                ,
            ), {wrapper: MemoryRouter})
            const divBoardToSelect = screen.getByText(template1Title).parentElement
            expect(divBoardToSelect).not.toBeNull()

            act(() => {
                userEvent.click(divBoardToSelect!)
            })

            const useTemplateButton = screen.getByText('Use this template').parentElement
            expect(useTemplateButton).not.toBeNull()
            act(() => {
                userEvent.click(useTemplateButton!)
            })

            await waitFor(() => expect(mockedMutator.addBoardFromTemplate).toBeCalledTimes(1))
            await waitFor(() => expect(mockedMutator.addBoardFromTemplate).toBeCalledWith(team1.id, expect.anything(), expect.anything(), expect.anything(), '1', team1.id))
            await waitFor(() => expect(mockedMutator.updateBoard).toBeCalledWith(newBoard, newBoard, 'linked channel'))
        })

        test('return BoardTemplateSelector and click to add board from template with channelId', async () => {
            const newBoard = createBoard({id: 'new-board'} as Board)
            mockedMutator.addBoardFromTemplate.mockResolvedValue({boards: [newBoard], blocks: []})

            render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <BoardTemplateSelector
                        onClose={jest.fn()}
                        channelId='test-channel'
                    />
                </ReduxProvider>
                ,
            ), {wrapper: MemoryRouter})
            const divBoardToSelect = screen.getByText(template1Title).parentElement
            expect(divBoardToSelect).not.toBeNull()

            act(() => {
                userEvent.click(divBoardToSelect!)
            })

            const useTemplateButton = screen.getByText('Use this template').parentElement
            expect(useTemplateButton).not.toBeNull()
            act(() => {
                userEvent.click(useTemplateButton!)
            })

            await waitFor(() => expect(mockedMutator.addBoardFromTemplate).toBeCalledTimes(1))
            await waitFor(() => expect(mockedMutator.addBoardFromTemplate).toBeCalledWith(team1.id, expect.anything(), expect.anything(), expect.anything(), '1', team1.id))
            await waitFor(() => expect(mockedMutator.updateBoard).toBeCalledWith({...newBoard, channelId: 'test-channel'}, newBoard, 'linked channel'))
        })

        test('return BoardTemplateSelector and click to add board from global template', async () => {
            const newBoard = createBoard({id: 'new-board'} as Board)
            mockedMutator.addBoardFromTemplate.mockResolvedValue({boards: [newBoard], blocks: []})

            render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <BoardTemplateSelector onClose={jest.fn()}/>
                </ReduxProvider>
                ,
            ), {wrapper: MemoryRouter})
            const divBoardToSelect = screen.getByText(globalTemplateTitle).parentElement
            expect(divBoardToSelect).not.toBeNull()

            act(() => {
                userEvent.click(divBoardToSelect!)
            })

            const useTemplateButton = screen.getByText('Use this template').parentElement
            expect(useTemplateButton).not.toBeNull()
            act(() => {
                userEvent.click(useTemplateButton!)
            })
            await waitFor(() => expect(mockedMutator.addBoardFromTemplate).toBeCalledTimes(1))
            await waitFor(() => expect(mockedMutator.addBoardFromTemplate).toBeCalledWith(team1.id, expect.anything(), expect.anything(), expect.anything(), 'global-1', team1.id))
            await waitFor(() => expect(mockedTelemetry.trackEvent).toBeCalledWith('boards', 'createBoardViaTemplate', {boardTemplateId: 'template_id_global'}))
            await waitFor(() => expect(mockedMutator.updateBoard).toBeCalledWith(newBoard, newBoard, 'linked channel'))
        })
        test('should start product tour on choosing welcome template', async () => {
            const newBoard = createBoard({id: 'new-board'} as Board)
            mockedMutator.addBoardFromTemplate.mockResolvedValue({boards: [newBoard], blocks: []})

            render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <BoardTemplateSelector onClose={jest.fn()}/>
                </ReduxProvider>
                ,
            ), {wrapper: MemoryRouter})
            const divBoardToSelect = screen.getByText('Welcome to Boards!').parentElement
            expect(divBoardToSelect).not.toBeNull()

            act(() => {
                userEvent.click(divBoardToSelect!)
            })

            const useTemplateButton = screen.getByText('Use this template').parentElement
            expect(useTemplateButton).not.toBeNull()
            act(() => {
                userEvent.click(useTemplateButton!)
            })

            await waitFor(() => expect(mockedMutator.addBoardFromTemplate).toBeCalledTimes(1))
            await waitFor(() => expect(mockedMutator.addBoardFromTemplate).toBeCalledWith(team1.id, expect.anything(), expect.anything(), expect.anything(), '2', team1.id))
            await waitFor(() => expect(mockedTelemetry.trackEvent).toBeCalledWith('boards', 'createBoardViaTemplate', {boardTemplateId: 'template_id_2'}))
            await waitFor(() => expect(mockedMutator.updateBoard).toBeCalledWith(newBoard, newBoard, 'linked channel'))
            expect(mockedOctoClient.patchUserConfig).toBeCalledWith('user-id-1', {
                updatedFields: {
                    onboardingTourStarted: '1',
                    onboardingTourStep: '0',
                    tourCategory: 'onboarding',
                },
            })
        })
    })
})
