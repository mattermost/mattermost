// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {
    act,
    fireEvent,
    render,
    screen
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'

import {mockDOM, wrapDNDIntl, mockStateStore} from 'src/testUtils'

import {TestBlockFactory} from 'src/test/testBlockFactory'

import {MarkdownEditor} from './markdownEditor'

jest.mock('src/utils')
jest.useFakeTimers()
jest.mock('draft-js/lib/generateRandomKey', () => () => '123')

describe('components/markdownEditor', () => {
    beforeAll(mockDOM)
    beforeEach(jest.clearAllMocks)

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
                    <MarkdownEditor
                        id={'test-id'}
                        text={''}
                        placeholderText={'placeholder'}
                        className={'classname-test'}
                        readonly={false}
                        onChange={jest.fn()}
                        onFocus={jest.fn()}
                        onBlur={jest.fn()}
                    />
                </ReduxProvider>,
            ))
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot with initial text', async () => {
        let container
        await act(async () => {
            const result = render(wrapDNDIntl(
                <ReduxProvider store={store}>

                    <MarkdownEditor
                        id={'test-id'}
                        text={'some initial text already set'}
                        placeholderText={'placeholder'}
                        className={'classname-test'}
                        readonly={false}
                        onChange={jest.fn()}
                        onFocus={jest.fn()}
                        onBlur={jest.fn()}
                    />
                </ReduxProvider>,

            ))
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot with on click on preview element', async () => {
        let container
        await act(async () => {
            const result = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <MarkdownEditor
                        id={'test-id'}
                        text={'some initial text already set'}
                        placeholderText={'placeholder'}
                        className={'classname-test'}
                        readonly={false}
                        onChange={jest.fn()}
                        onFocus={jest.fn()}
                        onBlur={jest.fn()}
                    />
                </ReduxProvider>,

            ))
            container = result.container
            const previewElement = screen.getByTestId('preview-element')
            userEvent.click(previewElement)
        })
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot with on click on preview element and then click out of it', async () => {
        let container
        await act(async () => {
            const result = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <MarkdownEditor
                        id={'test-id'}
                        text={'some initial text already set'}
                        placeholderText={'placeholder'}
                        className={'classname-test'}
                        readonly={false}
                        onChange={jest.fn()}
                        onFocus={jest.fn()}
                        onBlur={jest.fn()}
                    />
                </ReduxProvider>,

            ))
            container = result.container
            const previewElement = screen.getByTestId('preview-element')
            userEvent.click(previewElement)
            fireEvent.keyDown(container, {
                key: 'Escape',
                code: 'Escape',
                keyCode: 27,
                charCode: 27,
            })
        })
        expect(container).toMatchSnapshot()
    })
})
