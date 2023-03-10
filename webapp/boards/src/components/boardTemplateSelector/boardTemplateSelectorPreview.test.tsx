// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {render, waitFor} from '@testing-library/react'
import React from 'react'
import {MockStoreEnhanced} from 'redux-mock-store'

import {Provider as ReduxProvider} from 'react-redux'

import {IPropertyTemplate} from 'src/blocks/board'
import {mockDOM, mockStateStore, wrapDNDIntl} from 'src/testUtils'

import {TestBlockFactory} from 'src/test/testBlockFactory'

import BoardTemplateSelectorPreview from './boardTemplateSelectorPreview'

jest.mock('react-router-dom', () => {
    const originalModule = jest.requireActual('react-router-dom')

    return {
        ...originalModule,
        useRouteMatch: jest.fn(() => {
            return {url: '/'}
        }),
    }
})

const groupProperty: IPropertyTemplate = {
    id: 'group-prop-id',
    name: 'name',
    type: 'text',
    options: [
        {
            color: 'propColorOrange',
            id: 'property_value_id_1',
            value: 'Q1',
        },
        {
            color: 'propColorBlue',
            id: 'property_value_id_2',
            value: 'Q2',
        },
    ],
}

jest.mock('src/octoClient', () => {
    return {
        getAllBlocks: jest.fn(() => Promise.resolve([
            {
                id: '1',
                teamId: 'team',
                title: 'Template',
                type: 'board',
                icon: '🚴🏻‍♂️',
                cardProperties: [groupProperty],
                dateDisplayPropertyId: 'id-5',
            },
            {
                id: '2',
                workspaceId: 'workspace',
                title: 'View',
                type: 'view',
                fields: {
                    groupById: 'group-prop-id',
                    viewType: 'board',
                    visibleOptionIds: ['group-prop-id'],
                    hiddenOptionIds: [],
                    visiblePropertyIds: ['group-prop-id'],
                    sortOptions: [],
                    kanbanCalculations: {},
                },
            },
            {
                id: '3',
                workspaceId: 'workspace',
                title: 'Card',
                type: 'card',
                fields: {
                    icon: '🚴🏻‍♂️',
                    properties: {
                        'group-prop-id': 'test',
                    },
                },
                limited: false,
            },
        ])),
    }
})
jest.mock('src/utils')
jest.mock('src/mutator')

describe('components/boardTemplateSelector/boardTemplateSelectorPreview', () => {
    const template1Title = 'Template 1'
    const globalTemplateTitle = 'Template Global'
    const boardTitle = 'Board 1'
    let store: MockStoreEnhanced<unknown, unknown>
    beforeAll(mockDOM)
    beforeEach(() => {
        jest.clearAllMocks()

        const board = TestBlockFactory.createBoard()
        board.id = '2'
        board.title = boardTitle
        board.teamId = 'team-id'
        board.icon = '🚴🏻‍♂️'
        board.cardProperties = [groupProperty]
        const activeView = TestBlockFactory.createBoardView(board)
        activeView.fields.defaultTemplateId = 'defaultTemplateId'

        const state = {
            searchText: {value: ''},
            users: {
                me: {
                    id: 'user-id',
                },
                myConfig: {
                    onboardingTourStarted: {value: false},
                },
            },
            cards: {
                templates: [],
                cards: {
                    card_id_1: {title: 'Create a new card'},
                },
                current: 'card_id_1',
            },
            views: {
                views: {
                    boardView: activeView,
                },
                current: 'boardView',
            },
            contents: {contents: []},
            comments: {comments: []},
            teams: {
                current: {id: 'team-id'},
            },
            boards: {
                current: board.id,
                boards: {
                    [board.id]: board,
                },
                templates: [
                    {
                        id: '1',
                        teamId: 'team-id',
                        title: template1Title,
                        icon: '🚴🏻‍♂️',
                        cardProperties: [groupProperty],
                        dateDisplayPropertyId: 'id-5',
                    },
                ],
                cards: [],
                views: [],
                myBoardMemberships: {
                    [board.id]: {userId: 'user-id', schemeAdmin: true},
                },
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
                }],
            },
            limits: {
                limits: {
                    views: 0,
                },
            },
        }
        store = mockStateStore([], state)
    })

    test('should match snapshot', async () => {
        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <BoardTemplateSelectorPreview activeTemplate={(store.getState() as any).boards.templates[0]}/>
            </ReduxProvider>
            ,
        ))
        await waitFor(() => expect(container.querySelector('.top-head')).not.toBeNull())
        expect(container).toMatchSnapshot()
    })
    test('should be null without activeTemplate', () => {
        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <BoardTemplateSelectorPreview activeTemplate={null}/>
            </ReduxProvider>
            ,
        ))
        expect(container).toMatchSnapshot()
    })
})
