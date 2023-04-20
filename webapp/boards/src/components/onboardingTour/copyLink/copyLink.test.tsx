// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import {render} from '@testing-library/react'

import configureStore from 'redux-mock-store'

import {Provider as ReduxProvider} from 'react-redux'

import {wrapIntl} from 'src/testUtils'

import CopyLinkTourStep from './copy_link'

describe('components/onboardingTour/addComments/CopyLinkTourStep', () => {
    const mockStore = configureStore([])
    const state = {
        users: {
            me: {
                id: 'user_id_1',
            },
            myConfig: {
                onboardingTourStarted: {value: true},
                tourCategory: {value: 'board'},
                onboardingTourStep: {value: '1'},
            },
        },
        boards: {
            boards: {
                board_id_1: {title: 'Welcome to Boards!'},
            },
            current: 'board_id_1',
        },
        clientConfig: {
            value: {
                featureFlags: {},
            },
        },
    }
    let store = mockStore(state)

    beforeEach(() => {
        store = mockStore(state)
    })

    test('before hover', () => {
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <CopyLinkTourStep/>
            </ReduxProvider>,
        )
        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })

    test('after hover', () => {
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <CopyLinkTourStep/>
            </ReduxProvider>,
        )
        render(component)
        const elements = document.querySelectorAll('.CopyLinkTourStep')
        expect(elements.length).toBe(2)
        expect(elements[1]).toMatchSnapshot()
    })
})
