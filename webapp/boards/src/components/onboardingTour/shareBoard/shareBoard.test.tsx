// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import {render} from '@testing-library/react'

import configureStore from 'redux-mock-store'

import {Provider as ReduxProvider} from 'react-redux'

import {wrapIntl} from 'src/testUtils'

import ShareBoardTourStep from './shareBoard'

describe('components/onboardingTour/addComments/ShareBoardTourStep', () => {
    const mockStore = configureStore([])
    const state = {
        users: {
            me: {
                id: 'user_id_1',
            },
            myConfig: {
                onboardingTourStarted: {value: true},
                tourCategory: {value: 'board'},
                onboardingTourStep: {value: '2'},
            },
        },
        boards: {
            boards: {
                board_id_1: {title: 'Welcome to Boards!'},
            },
            current: 'board_id_1',
        },
        cards: {
            cards: {
                card_id_1: {title: 'Create a new card'},
            },
            current: 'card_id_1',
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
                <ShareBoardTourStep/>
            </ReduxProvider>,
        )
        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })

    test('after hover', () => {
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <ShareBoardTourStep/>
            </ReduxProvider>,
        )
        render(component)
        const elements = document.querySelectorAll('.ShareBoardTourStep')
        expect(elements.length).toBe(2)
        expect(elements[1]).toMatchSnapshot()
    })
})
