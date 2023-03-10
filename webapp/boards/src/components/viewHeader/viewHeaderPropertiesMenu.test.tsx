// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {render, screen} from '@testing-library/react'
import {Provider as ReduxProvider} from 'react-redux'

import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'

import {mocked} from 'jest-mock'

import {BoardView} from 'src/blocks/boardView'

import {TestBlockFactory} from 'src/test/testBlockFactory'

import mutator from 'src/mutator'

import {mockStateStore, wrapIntl} from 'src/testUtils'

import {Constants} from 'src/constants'

import ViewHeaderPropertiesMenu from './viewHeaderPropertiesMenu'

jest.mock('src/mutator')
const mockedMutator = mocked(mutator, true)

const board = TestBlockFactory.createBoard()
let activeView: BoardView

describe('components/viewHeader/viewHeaderPropertiesMenu', () => {
    const state = {
        users: {
            me: {
                id: 'user-id-1',
                username: 'username_1'},
        },
    }
    const store = mockStateStore([], state)
    beforeEach(() => {
        jest.clearAllMocks()
        activeView = TestBlockFactory.createBoardView(board)
    })
    test('return properties menu', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <ViewHeaderPropertiesMenu
                        activeView={activeView}
                        properties={board.cardProperties}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getByRole('button', {name: 'Properties menu'})
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
    })
    test('return properties menu with gallery typeview', () => {
        activeView.fields.viewType = 'gallery'
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <ViewHeaderPropertiesMenu
                        activeView={activeView}
                        properties={board.cardProperties}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getByRole('button', {name: 'Properties menu'})
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
    })
    test('show menu and verify the call for showing card badges', () => {
        render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <ViewHeaderPropertiesMenu
                        activeView={activeView}
                        properties={board.cardProperties}
                    />
                </ReduxProvider>,
            ),
        )
        const menuButton = screen.getByRole('button', {name: 'Properties menu'})
        userEvent.click(menuButton)
        const badgesButton = screen.getByRole('button', {name: 'Comments and description'})
        userEvent.click(badgesButton)
        expect(mockedMutator.changeViewVisibleProperties).toHaveBeenCalledWith(
            activeView.boardId,
            activeView.id,
            activeView.fields.visiblePropertyIds,
            [...activeView.fields.visiblePropertyIds, Constants.badgesColumnId],
        )
    })
    test('show menu and verify that it is not closed after clicking on the item', () => {
        render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <ViewHeaderPropertiesMenu
                        activeView={activeView}
                        properties={board.cardProperties}
                    />
                </ReduxProvider>,
            ),
        )
        const menuButton = screen.getByRole('button', {name: 'Properties menu'})
        userEvent.click(menuButton)

        const property1Button = screen.getByRole('button', {name: 'Property 1'})
        userEvent.click(property1Button)
        expect(property1Button).toBeInTheDocument()

        const property2Button = screen.getByRole('button', {name: 'Property 2'})
        userEvent.click(property2Button)
        expect(property2Button).toBeInTheDocument()

        expect(mockedMutator.changeViewVisibleProperties).toHaveBeenCalledTimes(2)
    })
})
