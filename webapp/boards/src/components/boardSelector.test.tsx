// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import {
    render,
    screen,
    act,
    fireEvent
} from '@testing-library/react'
import {mocked} from 'jest-mock'

import userEvent from '@testing-library/user-event'

import octoClient from 'src/octoClient'
import {mockStateStore} from 'src/testUtils'
import {createBoard} from 'src/blocks/board'
import {wrapIntl} from 'src/testUtils'

import BoardSelector from './boardSelector'

jest.mock('src/octoClient')
const mockedOctoClient = mocked(octoClient, true)

const wait = (ms: number) => {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, ms)
    })
}

describe('components/boardSelector', () => {
    const team = {
        id: 'team-id',
        name: 'team',
        display_name: 'Team name',
    }
    const state = {
        teams: {
            allTeams: [team],
            current: team,
            currentId: team.id,
        },
        language: {
            value: 'en',
        },
        boards: {
            linkToChannel: 'channel-id',
        },
    }

    it('renders without start searching', async () => {
        const store = mockStateStore([], state)
        const {container} = render(wrapIntl(
            <ReduxProvider store={store}>
                <BoardSelector/>
            </ReduxProvider>
        ))
        expect(container).toMatchSnapshot()
    })

    it('renders with no results', async () => {
        mockedOctoClient.searchLinkableBoards.mockResolvedValueOnce([])

        const store = mockStateStore([], state)
        const {container} = render(wrapIntl(
            <ReduxProvider store={store}>
                <BoardSelector/>
            </ReduxProvider>
        ))

        await act(async () => {
            const inputElement = screen.getByPlaceholderText('Search for boards')
            await userEvent.type(inputElement, 'test')
            await wait(300)
        })

        expect(container).toMatchSnapshot()
    })

    it('renders with some results', async () => {
        mockedOctoClient.searchLinkableBoards.mockResolvedValueOnce([createBoard(), createBoard(), createBoard()])

        const store = mockStateStore([], state)
        const {container} = render(wrapIntl(
            <ReduxProvider store={store}>
                <BoardSelector/>
            </ReduxProvider>
        ))

        await act(async () => {
            const inputElement = screen.getByPlaceholderText('Search for boards')
            await userEvent.type(inputElement, 'test')
            await wait(300)
        })

        expect(container).toMatchSnapshot()
    })

    it("escape button should unmount the component", () => {
        mockedOctoClient.searchLinkableBoards.mockResolvedValueOnce([])

        const store = mockStateStore([], state)
        const origDispatch = store.dispatch
        store.dispatch = jest.fn(origDispatch)
        const {container, getByText} = render(wrapIntl(
            <ReduxProvider store={store}>
                <BoardSelector/>
            </ReduxProvider>
        ))

        expect(getByText(/Link boards/i)).not.toBeNull()

        expect(store.dispatch).toHaveBeenCalledTimes(0)

        fireEvent.keyDown(getByText(/Link boards/i), {
            key: "Escape",
            code: "Escape",
            keyCode: 27,
            charCode: 27
        })

        expect(store.dispatch).toHaveBeenCalledTimes(2)
        expect(container).toMatchSnapshot()
    })
})
