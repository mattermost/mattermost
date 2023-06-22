// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import {
    act,
    fireEvent,
    render,
    screen,
} from '@testing-library/react'

import {
    mockDOM,
    mockStateStore,
    setup,
    wrapDNDIntl,
} from 'src/testUtils'
import {TestBlockFactory} from 'src/test/testBlockFactory'

import BlockContent from './blockContent'

jest.mock('draft-js/lib/generateRandomKey', () => () => '123')

describe('components/blocksEditor/blockContent', () => {
    beforeEach(mockDOM)

    const block = {id: '1', value: 'Title', contentType: 'h1'}

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
                    <BlockContent
                        boardId='fake-board-id'
                        block={block}
                        contentOrder={[block.id]}
                        editing={null}
                        setEditing={jest.fn()}
                        setAfterBlock={jest.fn()}
                        onSave={jest.fn()}
                        onMove={jest.fn()}
                    />
                </ReduxProvider>,
            ))
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot editing', async () => {
        let container
        await act(async () => {
            const result = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <BlockContent
                        boardId='fake-board-id'
                        block={block}
                        contentOrder={[block.id]}
                        editing={block}
                        setEditing={jest.fn()}
                        setAfterBlock={jest.fn()}
                        onSave={jest.fn()}
                        onMove={jest.fn()}
                    />
                </ReduxProvider>,
            ))
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })

    test('should call setEditing on click the content', async () => {
        const setEditing = jest.fn()
        await act(async () => {
            render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <BlockContent
                        boardId='fake-board-id'
                        block={block}
                        contentOrder={[block.id]}
                        editing={null}
                        setEditing={setEditing}
                        setAfterBlock={jest.fn()}
                        onSave={jest.fn()}
                        onMove={jest.fn()}
                    />
                </ReduxProvider>,
            ))
        })
        const item = screen.getByTestId('block-content')
        expect(setEditing).not.toBeCalled()
        fireEvent.click(item)
        expect(setEditing).toBeCalledWith(block)
    })

    test('should call setEditing on click the content', async () => {
        const setAfterBlock = jest.fn()
        await act(async () => {
            render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <BlockContent
                        boardId='fake-board-id'
                        block={block}
                        contentOrder={[block.id]}
                        editing={null}
                        setEditing={jest.fn()}
                        setAfterBlock={setAfterBlock}
                        onSave={jest.fn()}
                        onMove={jest.fn()}
                    />
                </ReduxProvider>,
            ))
        })
        const item = screen.getByTestId('add-action')
        expect(setAfterBlock).not.toBeCalled()
        fireEvent.click(item)
        expect(setAfterBlock).toBeCalledWith(block)
    })

    test('should call onSave on hit enter in the input', async () => {
        const onSave = jest.fn()

        const {user} = setup(wrapDNDIntl(
            <ReduxProvider store={store}>
                <BlockContent
                    boardId='fake-board-id'
                    block={block}
                    contentOrder={[block.id]}
                    editing={block}
                    setEditing={jest.fn()}
                    setAfterBlock={jest.fn()}
                    onSave={onSave}
                    onMove={jest.fn()}
                />
            </ReduxProvider>,
        ))
        const input = screen.getByDisplayValue('Title')
        expect(onSave).not.toBeCalled()
        await act(async () => {
            await user.clear(input)
            await user.type(input, 'test')
            await user.keyboard('{Enter}')
        })

        expect(onSave).toBeCalledWith(expect.objectContaining({value: 'test'}))
    })
})
