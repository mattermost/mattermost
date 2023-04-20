// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import {mockDOM, wrapDNDIntl} from 'src/testUtils'

import Modal from './modal'

describe('components/modal', () => {
    beforeAll(mockDOM)
    beforeEach(jest.clearAllMocks)
    test('should match snapshot', () => {
        const {container} = render(wrapDNDIntl(
            <Modal
                onClose={jest.fn()}
            >
                <div id='test'/>
            </Modal>,
        ))
        expect(container).toMatchSnapshot()
    })
    test('return Modal and close', async () => {
        const onMockedClose = jest.fn()
        render(wrapDNDIntl(
            <Modal
                onClose={onMockedClose}
            >
                <div id='test'/>
            </Modal>,
        ))
        const buttonClose = screen.getByRole('button', {name: 'Close'})
        await userEvent.click(buttonClose)
        expect(onMockedClose).toBeCalledTimes(1)
    })
    test('return Modal on position top', () => {
        const {container} = render(wrapDNDIntl(
            <Modal
                position={'top'}
                onClose={jest.fn()}
            >
                <div id='test'/>
            </Modal>,
        ))
        expect(container).toMatchSnapshot()
    })

    test('return Modal on position bottom', () => {
        const {container} = render(wrapDNDIntl(
            <Modal
                position={'bottom'}
                onClose={jest.fn()}
            >
                <div id='test'/>
            </Modal>,
        ))
        expect(container).toMatchSnapshot()
    })

    test('return Modal on position bottom-right', () => {
        const {container} = render(wrapDNDIntl(
            <Modal
                position={'bottom-right'}
                onClose={jest.fn()}
            >
                <div id='test'/>
            </Modal>,
        ))
        expect(container).toMatchSnapshot()
    })
})
