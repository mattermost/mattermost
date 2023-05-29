// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {render, waitFor} from '@testing-library/react'

import {Provider as ReduxProvider} from 'react-redux'

import {MemoryRouter} from 'react-router-dom'

import userEvent from '@testing-library/user-event'

import {mocked} from 'jest-mock'

import {IAppWindow} from 'src/types'

import {mockStateStore, wrapDNDIntl} from 'src/testUtils'
import {TestBlockFactory} from 'src/test/testBlockFactory'
import {Board} from 'src/blocks/board'

import client from 'src/octoClient'

import {ViewLimitModal} from './viewLimitDialog'

jest.mock('src/octoClient')
const mockedOctoClient = mocked(client)

declare let window: IAppWindow

describe('components/viewLimitDialog/ViewLiimitDialog', () => {
    const board: Board = {
        ...TestBlockFactory.createBoard(),
        id: 'board_id_1',
    }

    const state = {
        users: {
            me: {
                id: 'user_id_1',
                username: 'Michael Scott',
                roles: 'system_user',
            },
        },
        boards: {
            boards: {
                [board.id]: board,
            },
            current: board.id,
        },
    }

    const store = mockStateStore([], state)
    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('show notify upgrade button for non sys admin user', async () => {
        const handleOnClose = jest.fn()
        const handleShowNotifyAdminSuccess = jest.fn()
        mockedOctoClient.notifyAdminUpgrade.mockResolvedValue()

        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <ViewLimitModal
                    onClose={handleOnClose}
                    showNotifyAdminSuccess={handleShowNotifyAdminSuccess}
                />
            </ReduxProvider>,
        ), {wrapper: MemoryRouter})
        expect(container).toMatchSnapshot()

        const notifyBtn = container.querySelector('button.primaryAction')
        expect(notifyBtn).toBeDefined()
        expect(notifyBtn).not.toBeNull()
        expect(notifyBtn!.textContent).toBe('Notify Admin')
        await userEvent.click(notifyBtn as Element)
        await waitFor(() => expect(handleShowNotifyAdminSuccess).toBeCalledTimes(1))

        const cancelBtn = container.querySelector('button.cancel')
        expect(cancelBtn).toBeDefined()
        expect(cancelBtn).not.toBeNull()
        await userEvent.click(cancelBtn as Element)

        // on close called twice.
        // once when clicking on notify admin btn
        // and once when clicking on cancel btn
        expect(handleOnClose).toBeCalledTimes(2)
    })

    test('show upgrade button for sys admin user', async () => {
        const handleOnClose = jest.fn()
        const handleShowNotifyAdminSuccess = jest.fn()
        mockedOctoClient.notifyAdminUpgrade.mockResolvedValue()

        const handleOpenPricingModalEmbeddedFunc = jest.fn()
        const handleOpenPricingModal = () => handleOpenPricingModalEmbeddedFunc
        window.openPricingModal = handleOpenPricingModal

        const localState = {
            ...state,
        }

        localState.users.me.roles = 'system_admin'
        const localStore = mockStateStore([], localState)

        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={localStore}>
                <ViewLimitModal
                    onClose={handleOnClose}
                    showNotifyAdminSuccess={handleShowNotifyAdminSuccess}
                />
            </ReduxProvider>,
        ), {wrapper: MemoryRouter})
        expect(container).toMatchSnapshot()

        const notifyBtn = container.querySelector('button.primaryAction')
        expect(notifyBtn).toBeDefined()
        expect(notifyBtn).not.toBeNull()
        expect(notifyBtn!.textContent).toBe('Upgrade')
        await userEvent.click(notifyBtn as Element)
        expect(handleShowNotifyAdminSuccess).toBeCalledTimes(0)
        await waitFor(() => expect(handleOpenPricingModalEmbeddedFunc).toBeCalledTimes(1))

        const cancelBtn = container.querySelector('button.cancel')
        expect(cancelBtn).toBeDefined()
        expect(cancelBtn).not.toBeNull()
        await userEvent.click(cancelBtn as Element)

        // on close called twice.
        // once when clicking on notify admin btn
        // and once when clicking on cancel btn
        expect(handleOnClose).toBeCalledTimes(2)
    })
})
