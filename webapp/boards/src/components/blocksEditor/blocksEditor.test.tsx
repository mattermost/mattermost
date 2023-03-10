// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import {
    render,
    screen,
    fireEvent,
    act
} from '@testing-library/react'

import {mockDOM, wrapDNDIntl, mockStateStore} from 'src/testUtils'
import {TestBlockFactory} from 'src/test/testBlockFactory'

import {BlockData} from './blocks/types'
import BlocksEditor from './blocksEditor'

jest.mock('draft-js/lib/generateRandomKey', () => () => '123')

describe('components/blocksEditor/blocksEditor', () => {
    beforeEach(mockDOM)

    const blocks: Array<BlockData<any>> = [
        {id: '1', value: 'Title', contentType: 'h1'},
        {id: '2', value: 'Sub title', contentType: 'h2'},
        {id: '3', value: 'Sub sub title', contentType: 'h3'},
        {id: '4', value: 'Some **markdown** text', contentType: 'text'},
        {id: '5', value: 'Some multiline\n**markdown** text\n### With Items\n- Item 1\n- Item2\n- Item3', contentType: 'text'},
        {id: '6', value: {checked: true, value: 'Checkbox'}, contentType: 'checkbox'},
    ]

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

    test('should match snapshot on empty', async () => {
        let container
        await act(async () => {
            const result = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <BlocksEditor
                        boardId='test-board'
                        onBlockCreated={jest.fn()}
                        onBlockModified={jest.fn()}
                        onBlockMoved={jest.fn()}
                        blocks={[]}
                    />
                </ReduxProvider>,
            ))
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot with blocks', async () => {
        let container
        await act(async () => {
            const result = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <BlocksEditor
                        boardId='test-board'
                        onBlockCreated={jest.fn()}
                        onBlockModified={jest.fn()}
                        onBlockMoved={jest.fn()}
                        blocks={blocks}
                    />
                </ReduxProvider>,
            ))
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })

    test('should call onBlockCreate after introduce text and hit enter', async () => {
        const onBlockCreated = jest.fn()
        await act(async () => {
            render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <BlocksEditor
                        boardId='test-board'
                        onBlockCreated={onBlockCreated}
                        onBlockModified={jest.fn()}
                        onBlockMoved={jest.fn()}
                        blocks={[]}
                    />
                </ReduxProvider>,
            ))
        })

        let input = screen.getByDisplayValue('')
        expect(onBlockCreated).not.toBeCalled()
        fireEvent.change(input, {target: {value: '/title'}})
        fireEvent.keyDown(input, {key: 'Enter'})

        input = screen.getByDisplayValue('')
        fireEvent.change(input, {target: {value: 'test'}})
        fireEvent.keyDown(input, {key: 'Enter'})

        expect(onBlockCreated).toBeCalledWith(expect.objectContaining({value: 'test'}))
    })

    test('should call onBlockModified after introduce text and hit enter', async () => {
        const onBlockModified = jest.fn()
        await act(async () => {
            render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <BlocksEditor
                        boardId='test-board'
                        onBlockCreated={jest.fn()}
                        onBlockModified={onBlockModified}
                        onBlockMoved={jest.fn()}
                        blocks={blocks}
                    />
                </ReduxProvider>,
            ))
            const input = screen.getByTestId('checkbox-check')
            expect(onBlockModified).not.toBeCalled()
            fireEvent.click(input)
            expect(onBlockModified).toBeCalledWith(expect.objectContaining({value: {checked: false, value: 'Checkbox'}}))
        })
    })
})
