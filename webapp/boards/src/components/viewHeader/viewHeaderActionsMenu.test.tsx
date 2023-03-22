// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {render, screen} from '@testing-library/react'
import {Provider as ReduxProvider} from 'react-redux'

import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'

import {mocked} from 'jest-mock'

import {TestBlockFactory} from 'src/test/testBlockFactory'

import {wrapIntl, mockStateStore} from 'src/testUtils'

import {Archiver} from 'src/archiver'

import {CsvExporter} from 'src/csvExporter'

import ViewHeaderActionsMenu from './viewHeaderActionsMenu'

jest.mock('src/archiver')
jest.mock('src/csvExporter')
jest.mock('src/mutator')
const mockedArchiver = mocked(Archiver, true)
const mockedCsvExporter = mocked(CsvExporter, true)

const board = TestBlockFactory.createBoard()
const activeView = TestBlockFactory.createBoardView(board)
const card = TestBlockFactory.createCard(board)

describe('components/viewHeader/viewHeaderActionsMenu', () => {
    const state = {
        users: {
            me: {
                id: 'user-id-1',
                username: 'username_1',
            },
        },
    }
    const store = mockStateStore([], state)
    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('return menu', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <ViewHeaderActionsMenu
                        board={board}
                        activeView={activeView}
                        cards={[card]}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getByRole('button', {
            name: 'View header menu',
        })
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
    })

    test('return menu and verify call to csv exporter', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <ViewHeaderActionsMenu
                        board={board}
                        activeView={activeView}
                        cards={[card]}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getByRole('button', {name: 'View header menu'})
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const buttonExportCSV = screen.getByRole('button', {name: 'Export to CSV'})
        userEvent.click(buttonExportCSV)
        expect(mockedCsvExporter.exportTableCsv).toBeCalledTimes(1)
    })

    test('return menu and verify call to board archive', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <ViewHeaderActionsMenu
                        board={board}
                        activeView={activeView}
                        cards={[card]}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getByRole('button', {name: 'View header menu'})
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const buttonExportBoardArchive = screen.getByRole('button', {name: 'Export board archive'})
        userEvent.click(buttonExportBoardArchive)
        expect(mockedArchiver.exportBoardArchive).toBeCalledTimes(1)
        expect(mockedArchiver.exportBoardArchive).toBeCalledWith(board)
    })
})
