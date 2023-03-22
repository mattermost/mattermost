// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import {createMemoryHistory} from 'history'

import {render, act} from '@testing-library/react'

import userEvent from '@testing-library/user-event'
import configureStore from 'redux-mock-store'

import {mocked} from 'jest-mock'

import {wrapIntl} from 'src/testUtils'

import TelemetryClient, {TelemetryCategory, TelemetryActions} from 'src/telemetry/telemetryClient'

import client from 'src/octoClient'

import GlobalHeaderSettingsMenu from './globalHeaderSettingsMenu'

jest.mock('src/telemetry/telemetryClient')
jest.mock('src/octoClient')
const mockedTelemetry = mocked(TelemetryClient, true)
const mockedOctoClient = mocked(client, true)

describe('components/sidebar/GlobalHeaderSettingsMenu', () => {
    const mockStore = configureStore([])
    const history = createMemoryHistory()
    let store = mockStore({})
    beforeEach(() => {
        store = mockStore({
            teams: {
                current: {id: 'team_id_1'},
            },
            boards: {
                current: 'board_id',
                boards: {
                    board_id: {id: 'board_id'},
                },
                myBoardMemberships: {
                    board_id: {userId: 'user_id_1', schemeAdmin: true},
                },
            },
            users: {
                me: {
                    id: 'user-id',
                },
            },
        })
    })
    test('settings menu closed should match snapshot', () => {
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <GlobalHeaderSettingsMenu history={history}/>
            </ReduxProvider>,
        )

        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })

    test('settings menu open should match snapshot', () => {
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <GlobalHeaderSettingsMenu history={history}/>
            </ReduxProvider>,
        )

        const {container} = render(component)
        userEvent.click(container.querySelector('.menu-entry') as Element)
        expect(container).toMatchSnapshot()
    })

    test('languages menu open should match snapshot', () => {
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <GlobalHeaderSettingsMenu history={history}/>
            </ReduxProvider>,
        )

        const {container} = render(component)
        act(() => {
            userEvent.click(container.querySelector('.menu-entry') as Element)
        })
        act(() => {
            userEvent.hover(container.querySelector('#lang') as Element)
        })
        expect(container).toMatchSnapshot()
    })

    test('imports menu open should match snapshot', () => {
        window.open = jest.fn()
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <GlobalHeaderSettingsMenu history={history}/>
            </ReduxProvider>,
        )

        const {container} = render(component)
        act(() => {
            userEvent.click(container.querySelector('.menu-entry') as Element)
        })
        act(() => {
            userEvent.hover(container.querySelector('#import') as Element)
        })
        expect(container).toMatchSnapshot()

        userEvent.click(container.querySelector('[aria-label="Asana"]') as Element)
        expect(mockedTelemetry.trackEvent).toBeCalledWith(TelemetryCategory, TelemetryActions.ImportAsana)
    })

    test('Product Tour option restarts the tour', () => {
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <GlobalHeaderSettingsMenu history={history}/>
            </ReduxProvider>,
        )

        const {container} = render(component)
        act(() => {
            userEvent.click(container.querySelector('.menu-entry') as Element)
        })
        act(() => {
            userEvent.click(container.querySelector('.product-tour') as Element)
        })

        expect(mockedOctoClient.patchUserConfig).toBeCalledWith('user-id', {
            updatedFields: {
                onboardingTourStarted: '1',
                onboardingTourStep: '0',
                tourCategory: 'onboarding',
            },
        })
    })
})
