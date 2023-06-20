// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {render, screen, within} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'

import {Provider as ReduxProvider} from 'react-redux'

import userEvent from '@testing-library/user-event'

import {mocked} from 'jest-mock'

import Mutator from 'src/mutator'
import {Utils} from 'src/utils'

import {TestBlockFactory} from 'src/test/testBlockFactory'
import {IPropertyTemplate} from 'src/blocks/board'
import {mockStateStore, wrapDNDIntl} from 'src/testUtils'

import KanbanCard from './kanbanCard'

jest.mock('src/mutator')
jest.mock('src/utils')
jest.mock('src/telemetry/telemetryClient')
const mockedUtils = mocked(Utils)
const mockedMutator = mocked(Mutator)

describe('src/components/kanban/kanbanCard', () => {
    const board = TestBlockFactory.createBoard()
    const card = TestBlockFactory.createCard(board)
    const propertyTemplate: IPropertyTemplate = {
        id: 'id',
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
    const state = {
        cards: {
            cards: [card],
        },
        teams: {
            current: {id: 'team-id'},
        },
        boards: {
            current: 'board_id_1',
            boards: {
                board_id_1: {id: 'board_id_1'},
            },
            myBoardMemberships: {
                board_id_1: {userId: 'user_id_1', schemeAdmin: true},
            },
        },
        contents: {},
        comments: {
            comments: {},
        },
        users: {
            me: {
                id: 'user_id_1',
                props: {},
            },
        },
    }
    const store = mockStateStore([], state)
    beforeEach(jest.clearAllMocks)
    test('should match snapshot', () => {
        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <KanbanCard
                    card={card}
                    board={board}
                    visiblePropertyTemplates={[propertyTemplate]}
                    visibleBadges={false}
                    isSelected={false}
                    readonly={false}
                    onDrop={jest.fn()}
                    showCard={jest.fn()}
                    isManualSort={false}
                />
            </ReduxProvider>,
        ), {wrapper: MemoryRouter})
        expect(container).toMatchSnapshot()
    })
    test('should match snapshot with readonly', () => {
        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <KanbanCard
                    card={card}
                    board={board}
                    visiblePropertyTemplates={[propertyTemplate]}
                    visibleBadges={false}
                    isSelected={false}
                    readonly={true}
                    onDrop={jest.fn()}
                    showCard={jest.fn()}
                    isManualSort={false}
                />
            </ReduxProvider>,
        ), {wrapper: MemoryRouter})
        expect(container).toMatchSnapshot()
    })
    test('return kanbanCard and click on delete menu ', async () => {
        const result = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <KanbanCard
                    card={card}
                    board={board}
                    visiblePropertyTemplates={[propertyTemplate]}
                    visibleBadges={false}
                    isSelected={false}
                    readonly={false}
                    onDrop={jest.fn()}
                    showCard={jest.fn()}
                    isManualSort={false}
                />
            </ReduxProvider>,
        ), {wrapper: MemoryRouter})

        const {container} = result

        const elementMenuWrapper = screen.getByRole('button', {name: 'menuwrapper'})
        expect(elementMenuWrapper).not.toBeNull()
        await userEvent.click(elementMenuWrapper)
        expect(container).toMatchSnapshot()
        const elementButtonDelete = within(elementMenuWrapper).getByRole('button', {name: 'Delete'})
        expect(elementButtonDelete).not.toBeNull()
        await userEvent.click(elementButtonDelete)

        const confirmDialog = screen.getByTitle('Confirmation Dialog Box')
        expect(confirmDialog).toBeDefined()
        const confirmButton = within(confirmDialog).getByRole('button', {name: 'Delete'})
        expect(confirmButton).toBeDefined()
        await userEvent.click(confirmButton)

        expect(mockedMutator.deleteBlock).toBeCalledWith(card, 'delete card')
    })

    test('return kanbanCard and click on duplicate menu ', async () => {
        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <KanbanCard
                    card={card}
                    board={board}
                    visiblePropertyTemplates={[propertyTemplate]}
                    visibleBadges={false}
                    isSelected={false}
                    readonly={false}
                    onDrop={jest.fn()}
                    showCard={jest.fn()}
                    isManualSort={false}
                />
            </ReduxProvider>,
        ), {wrapper: MemoryRouter})
        const elementMenuWrapper = screen.getByRole('button', {name: 'menuwrapper'})
        expect(elementMenuWrapper).not.toBeNull()
        await userEvent.click(elementMenuWrapper)
        expect(container).toMatchSnapshot()
        const elementButtonDuplicate = within(elementMenuWrapper).getByRole('button', {name: 'Duplicate'})
        expect(elementButtonDuplicate).not.toBeNull()
        await userEvent.click(elementButtonDuplicate)
        expect(mockedMutator.duplicateCard).toBeCalledTimes(1)
    })

    test('return kanbanCard and click on copy link menu ', async () => {
        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <KanbanCard
                    card={card}
                    board={board}
                    visiblePropertyTemplates={[propertyTemplate]}
                    visibleBadges={false}
                    isSelected={false}
                    readonly={false}
                    onDrop={jest.fn()}
                    showCard={jest.fn()}
                    isManualSort={false}
                />
            </ReduxProvider>,
        ), {wrapper: MemoryRouter})
        const elementMenuWrapper = screen.getByRole('button', {name: 'menuwrapper'})
        expect(elementMenuWrapper).not.toBeNull()
        await userEvent.click(elementMenuWrapper)
        expect(container).toMatchSnapshot()
        const elementButtonCopyLink = within(elementMenuWrapper).getByRole('button', {name: 'Copy link'})
        expect(elementButtonCopyLink).not.toBeNull()
        await userEvent.click(elementButtonCopyLink)
        expect(mockedUtils.copyTextToClipboard).toBeCalledTimes(1)
    })
})
