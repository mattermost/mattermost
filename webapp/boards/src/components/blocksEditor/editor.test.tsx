// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import {act, render, screen} from '@testing-library/react'

import {
    mockDOM,
    mockStateStore,
    setup,
    wrapDNDIntl,
} from 'src/testUtils'
import {TestBlockFactory} from 'src/test/testBlockFactory'

import Editor from './editor'

jest.mock('draft-js/lib/generateRandomKey', () => () => '123')

describe('components/blocksEditor/editor', () => {
    beforeEach(mockDOM)

    const board1 = TestBlockFactory.createBoard()
    board1.id = 'board-id-1'

    const state = {
        users: {
            boardUsers: {
                1: {username: 'abc'},
                2: {username: 'd'},
                3: {username: 'e'},
                4: {username: 'f'},
                5: {username: 'g'},
            },
        },
        boards: {
            current: 'board-id-1',
            boards: {
                [board1.id]: board1,
            },
        },
        clientConfig: {
            value: {},
        },
    }
    const store = mockStateStore([], state)

    test('should match snapshot', async () => {
        let container
        await act(async () => {
            const result = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <Editor
                        id='block-id'
                        boardId='fake-board-id'
                        initialValue='test-value'
                        initialContentType='text'
                        onSave={jest.fn()}
                    />
                </ReduxProvider>,
            ))
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot on empty', async () => {
        let container
        await act(async () => {
            const result = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <Editor
                        boardId='fake-board-id'
                        onSave={jest.fn()}
                    />
                </ReduxProvider>,
            ))
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })

    test('should call onSave after introduce text and hit enter', async () => {
        const onSave = jest.fn()
        const {user} = setup(wrapDNDIntl(
            <ReduxProvider store={store}>
                <Editor
                    boardId='fake-board-id'
                    onSave={onSave}
                />
            </ReduxProvider>,
        ))
        await act(async () => {
            await user.type(screen.getByRole('combobox'), '/title')
            await user.keyboard('{Enter}')
            await user.type(screen.getByRole('textbox'), 'test')
            await user.keyboard('{Enter}')
        })

        expect(onSave).toBeCalledWith(expect.objectContaining({value: 'test'}))
    })
})
