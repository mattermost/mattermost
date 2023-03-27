// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {render, screen} from '@testing-library/react'

import userEvent from '@testing-library/user-event'

import {createBoard} from 'src/blocks/board'
import {wrapIntl} from 'src/testUtils'

import BoardSelectorItem from './boardSelectorItem'

describe('components/boardSelectorItem', () => {
    it('renders board without title', async () => {
        const board = createBoard()
        board.title = ""

        const {container} = render(wrapIntl(
            <BoardSelectorItem
                item={board}
                currentChannel={board.channelId || ''}
                linkBoard={jest.fn()}
                unlinkBoard={jest.fn()}
            />,
        ))
        expect(container).toMatchSnapshot()
    })

    it('renders linked board', async () => {
        const board = createBoard()
        board.title = "Test title"

        const {container} = render(wrapIntl(
            <BoardSelectorItem
                item={board}
                currentChannel={board.channelId || ''}
                linkBoard={jest.fn()}
                unlinkBoard={jest.fn()}
            />,
        ))
        expect(container).toMatchSnapshot()
    })

    it('renders not linked board', async () => {
        const board = createBoard()
        board.title = "Test title"

        const {container} = render(wrapIntl(
            <BoardSelectorItem
                item={board}
                currentChannel={'other-channel'}
                linkBoard={jest.fn()}
                unlinkBoard={jest.fn()}
            />,
        ))
        expect(container).toMatchSnapshot()
    })

    it('call handler on link', async () => {
        const board = createBoard()

        const linkBoard = jest.fn()
        const unlinkBoard = jest.fn()

        render(wrapIntl(
            <BoardSelectorItem
                item={board}
                currentChannel={'other-channel'}
                linkBoard={linkBoard}
                unlinkBoard={unlinkBoard}
            />,
        ))

        const buttonElement = screen.getByRole('button')
        await userEvent.click(buttonElement)
        expect(linkBoard).toBeCalledWith(board)
        expect(unlinkBoard).not.toBeCalled()
    })

    it('call handler on unlink', async () => {
        const board = createBoard()

        const linkBoard = jest.fn()
        const unlinkBoard = jest.fn()

        render(wrapIntl(
            <BoardSelectorItem
                item={board}
                currentChannel={board.channelId || ''}
                linkBoard={linkBoard}
                unlinkBoard={unlinkBoard}
            />,
        ))

        const buttonElement = screen.getByRole('button')
        await userEvent.click(buttonElement)
        expect(unlinkBoard).toBeCalledWith(board)
        expect(linkBoard).not.toBeCalled()
    })
})

