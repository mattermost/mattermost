// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {render} from '@testing-library/react'
import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'

import {BoardTypeOpen} from 'src/blocks/board'

import {TestBlockFactory} from 'src/test/testBlockFactory'
import {wrapDNDIntl, mockStateStore} from 'src/testUtils'

import ShareBoardButton from './shareBoardButton'

jest.useFakeTimers()

const boardId = '1'

const board = TestBlockFactory.createBoard()
board.id = boardId

describe('src/components/shareBoard/shareBoard', () => {
    const state = {
        boards: {
            boards: {
                [board.id]: board,
            },
            current: board.id,
        },
    }

    const store = mockStateStore([], state)

    test('should match snapshot, Private Board', async () => {
        const result = render(
            wrapDNDIntl(
                <ReduxProvider store={store}>
                    <ShareBoardButton
                        enableSharedBoards={true}
                    />
                </ReduxProvider>))

        const renderer = result.container

        expect(renderer).toMatchSnapshot()
    })

    test('should match snapshot, Open Board', async () => {
        board.type = BoardTypeOpen
        const result = render(
            wrapDNDIntl(
                <ReduxProvider store={store}>
                    <ShareBoardButton
                        enableSharedBoards={true}
                    />
                </ReduxProvider>))

        const renderer = result.container

        expect(renderer).toMatchSnapshot()
    })
})
