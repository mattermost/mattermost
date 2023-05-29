// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import {
    act,
    fireEvent,
    render,
    screen,
} from '@testing-library/react'

import {wrapIntl} from 'src/testUtils'

import FlashMessages, {sendFlashMessage} from './flashMessages'

jest.mock('src/mutator')

jest.useFakeTimers()

describe('components/flashMessages', () => {
    test('renders a flash message with high severity', async () => {
        const {container} = render(
            wrapIntl(<FlashMessages milliseconds={200}/>),
        )

        /**
         * Check for high severity
         */

        act(() => {
            sendFlashMessage({content: 'Mock Content', severity: 'high'})
        })

        expect(container).toMatchSnapshot()

        act(() => {
            jest.runAllTimers()
        })

        expect(screen.queryByText('Mock Content')).toBeNull()
    })

    test('renders a flash message with normal severity', () => {
        const {container} = render(
            wrapIntl(<FlashMessages milliseconds={200}/>),
        )

        act(() => {
            sendFlashMessage({content: 'Mock Content', severity: 'normal'})
        })

        expect(screen.getByText('Mock Content')).toHaveClass('normal')

        expect(container).toMatchSnapshot()

        act(() => {
            jest.runAllTimers()
        })

        expect(screen.queryByText('Mock Content')).toBeNull()
    })

    test('renders a flash message with low severity', () => {
        const {container} = render(
            wrapIntl(<FlashMessages milliseconds={200}/>),
        )

        act(() => {
            sendFlashMessage({content: 'Mock Content', severity: 'low'})
        })

        expect(screen.getByText('Mock Content')).toHaveClass('low')

        expect(container).toMatchSnapshot()

        act(() => {
            jest.runAllTimers()
        })

        expect(screen.queryByText('Mock Content')).toBeNull()
    })

    test('renders a flash message with low severity and custom HTML in flash message', () => {
        const {container} = render(
            wrapIntl(<FlashMessages milliseconds={200}/>),
        )

        act(() => {
            sendFlashMessage({content: <div data-testid='mock-test-id'>{'Mock Content'}</div>, severity: 'low'})
        })

        expect(screen.getByTestId('mock-test-id')).toBeVisible()

        expect(container).toMatchSnapshot()

        act(() => {
            jest.runAllTimers()
        })

        expect(screen.queryByText('Mock Content')).toBeNull()
    })

    test('renders a flash message with low severity and check onClick on flash works', async () => {
        const {container} = render(
            wrapIntl(<FlashMessages milliseconds={200}/>),
        )

        act(() => {
            sendFlashMessage({content: 'Mock Content', severity: 'low'})
        })

        fireEvent.click(screen.getByText('Mock Content'))

        expect(container).toMatchSnapshot()

        act(() => {
            jest.runAllTimers()
        })

        expect(screen.queryByText('Mock Content')).toBeNull()
    })
})
