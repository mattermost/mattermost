// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import {render, act} from '@testing-library/react'

import {mockDOM, wrapDNDIntl, mockStateStore} from 'src/testUtils'
import {TestBlockFactory} from 'src/test/testBlockFactory'

import TextBlock from '.'

jest.mock('draft-js/lib/generateRandomKey', () => () => '123')

describe('components/blocksEditor/blocks/text', () => {
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

    test('should match Display snapshot', async () => {
        const Component = TextBlock.Display
        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <Component
                    onChange={jest.fn()}
                    value='test-value'
                    onCancel={jest.fn()}
                    onSave={jest.fn()}
                />
            </ReduxProvider>,
        ))
        expect(container).toMatchSnapshot()
    })

    test('should match Input snapshot', async () => {
        let container
        await act(async () => {
            const Component = TextBlock.Input
            const result = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <Component
                        onChange={jest.fn()}
                        value='test-value'
                        onCancel={jest.fn()}
                        onSave={jest.fn()}
                    />
                </ReduxProvider>,
            ))
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })
})
