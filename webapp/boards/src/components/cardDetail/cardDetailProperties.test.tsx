// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {
    render,
    screen,
    act,
    fireEvent
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {mocked} from 'jest-mock'
import '@testing-library/jest-dom'
import {createIntl} from 'react-intl'

import configureStore from 'redux-mock-store'
import {Provider as ReduxProvider} from 'react-redux'

import {wrapIntl} from 'src/testUtils'
import {TestBlockFactory} from 'src/test/testBlockFactory'
import mutator from 'src/mutator'
import propsRegistry from 'src/properties'
import {PropertyType} from 'src/properties/types'

import CardDetailProperties from './cardDetailProperties'

jest.mock('src/mutator')
const mockedMutator = mocked(mutator, true)

describe('components/cardDetail/CardDetailProperties', () => {
    const board = TestBlockFactory.createBoard()
    board.cardProperties = [
        {
            id: 'property_id_1',
            name: 'Owner',
            type: 'select',
            options: [
                {
                    color: 'propColorDefault',
                    id: 'property_value_id_1',
                    value: 'Jean-Luc Picard',
                },
                {
                    color: 'propColorDefault',
                    id: 'property_value_id_2',
                    value: 'William Riker',
                },
                {
                    color: 'propColorDefault',
                    id: 'property_value_id_3',
                    value: 'Deanna Troi',
                },
            ],
        },
        {
            id: 'property_id_2',
            name: 'MockStatus',
            type: 'number',
            options: [],
        },
    ]

    const view = TestBlockFactory.createBoardView(board)
    view.fields.sortOptions = []
    view.fields.groupById = undefined
    view.fields.hiddenOptionIds = []
    const views = [view]

    const card = TestBlockFactory.createCard(board)
    card.fields.properties.property_id_1 = 'property_value_id_1'
    card.fields.properties.property_id_2 = '1234'

    const cardTemplate = TestBlockFactory.createCard(board)
    cardTemplate.fields.isTemplate = true

    const cards = [card]

    const state = {
        users: {
            me: {
                id: 'user_id_1',
            },
            myConfig: {
                onboardingTourStarted: {value: true},
                tourCategory: {value: 'card'},
                onboardingTourStep: {value: '1'},
            },
        },
        teams: {
            current: {id: 'team-id'},
        },
        boards: {
            boards: {
                [board.id]: board,
            },
            current: board.id,
            myBoardMemberships: {
                [board.id]: {userId: 'user_id_1', schemeAdmin: true},
            },
        },
        cards: {
            cards: {
                [card.id]: card,
            },
            current: card.id,
        },
        clientConfig: {
            value: {
                featureFlags: {},
            },
        },
    }

    const mockStore = configureStore([])
    let store = mockStore(state)

    beforeEach(() => {
        store = mockStore(state)
    })

    function renderComponent() {
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <CardDetailProperties
                    board={board!}
                    card={card}
                    cards={[card]}
                    activeView={view}
                    views={views}
                    readonly={false}
                />
            </ReduxProvider>,
        )

        return render(component)
    }

    it('should match snapshot', async () => {
        const {container} = renderComponent()
        expect(container).toMatchSnapshot()
    })

    it('should show confirmation dialog when deleting existing select property', () => {
        renderComponent()

        const menuElement = screen.getByRole('button', {name: 'Owner'})
        userEvent.click(menuElement)

        const deleteButton = screen.getByRole('button', {name: /delete/i})
        userEvent.click(deleteButton)

        expect(screen.getByRole('heading', {name: 'Confirm delete property'})).toBeInTheDocument()
        expect(screen.getByRole('button', {name: /delete/i})).toBeInTheDocument()
    })

    it('should show property types menu', () => {
        const intl = createIntl({locale: 'en'})
        const {container} = renderComponent()

        const menuElement = screen.getByRole('button', {name: /add a property/i})
        userEvent.click(menuElement)
        expect(container).toMatchSnapshot()

        const selectProperty = screen.getByText(/select property type/i)
        expect(selectProperty).toBeInTheDocument()

        propsRegistry.list().forEach((type: PropertyType) => {
            const typeButton = screen.getByRole('button', {name: type.displayName(intl)})
            expect(typeButton).toBeInTheDocument()
        })
    })

    it('should allow change property types menu, confirm', () => {
        renderComponent()

        const menuElement = screen.getByRole('button', {name: 'Owner'})
        userEvent.click(menuElement)

        const typeProperty = screen.getByText(/Type: Select/i)
        expect(typeProperty).toBeInTheDocument()

        fireEvent.mouseOver(typeProperty)

        const newTypeMenu = screen.getByRole('button', {name: 'Text'})
        userEvent.click(newTypeMenu)

        expect(screen.getByRole('heading', {name: 'Confirm property type change'})).toBeInTheDocument()
        expect(screen.getByRole('button', {name: /Change property/i})).toBeInTheDocument()
    })

    test('rename select property and confirm button on dialog should rename property', async () => {
        const result = renderComponent()

        // rename to "Owner-Renamed"
        onPropertyRenameNoConfirmationDialog(result.container)
        const propertyTemplate = board.cardProperties[0]

        // should be called once on confirming renaming the property
        expect(mockedMutator.changePropertyTypeAndName).toBeCalledTimes(1)
        expect(mockedMutator.changePropertyTypeAndName).toHaveBeenCalledWith(board, cards, propertyTemplate, 'select', 'Owner - Renamed')
    })

    it('should add new number property', async () => {
        renderComponent()

        const menuElement = screen.getByRole('button', {name: /add a property/i})
        userEvent.click(menuElement)

        await act(async () => {
            const numberType = screen.getByRole('button', {name: /number/i})
            userEvent.click(numberType)
        })

        expect(mockedMutator.insertPropertyTemplate).toHaveBeenCalledTimes(1)

        const args = mockedMutator.insertPropertyTemplate.mock.calls[0]
        const template = args[3]
        expect(template).toBeTruthy()
        expect(template!.name).toMatch(/number/i)
        expect(template!.type).toBe('number')
    })

    it('confirmation on delete dialog should delete the property', () => {
        const result = renderComponent()
        const container = result.container

        openDeleteConfirmationDialog(container)

        const propertyTemplate = board.cardProperties[0]

        const confirmButton = result.getByTitle('Delete')
        expect(confirmButton).toBeDefined()

        //click delete button
        userEvent.click(confirmButton!)

        // should be called once on confirming delete
        expect(mockedMutator.deleteProperty).toBeCalledTimes(1)
        expect(mockedMutator.deleteProperty).toBeCalledWith(board, views, cards, propertyTemplate.id)
    })

    it('cancel on delete dialog should do nothing', () => {
        const result = renderComponent()
        const container = result.container

        openDeleteConfirmationDialog(container)

        const cancelButton = result.getByTitle('Cancel')
        expect(cancelButton).toBeDefined()

        userEvent.click(cancelButton!)
        expect(container).toMatchSnapshot()
    })

    function openDeleteConfirmationDialog(container: HTMLElement) {
        const propertyLabel = container.querySelector('.MenuWrapper')
        expect(propertyLabel).toBeDefined()
        userEvent.click(propertyLabel!)

        const deleteOption = container.querySelector('.MenuOption.TextOption')
        expect(propertyLabel).toBeDefined()
        userEvent.click(deleteOption!)

        const confirmDialog = container.querySelector('.dialog.confirmation-dialog-box')
        expect(confirmDialog).toBeDefined()
    }

    function onPropertyRenameNoConfirmationDialog(container: HTMLElement) {
        const propertyLabel = container.querySelector('.MenuWrapper')
        expect(propertyLabel).toBeDefined()
        userEvent.click(propertyLabel!)

        // write new name in the name text box
        const propertyNameInput = container.querySelector('.PropertyMenu.menu-textbox')
        expect(propertyNameInput).toBeDefined()
        userEvent.type(propertyNameInput!, 'Owner - Renamed{enter}')
        userEvent.click(propertyLabel!)
    }
})
