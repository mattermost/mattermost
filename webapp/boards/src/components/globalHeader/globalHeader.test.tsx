// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import {createMemoryHistory} from 'history'

import {render} from '@testing-library/react'

import configureStore from 'redux-mock-store'

import {wrapIntl} from 'src/testUtils'

import GlobalHeader from './globalHeader'

describe('components/sidebar/GlobalHeader', () => {
    const mockStore = configureStore([])
    const history = createMemoryHistory()

    let store = mockStore({})
    beforeEach(() => {
        store = mockStore({})
    })
    test('header menu should match snapshot', () => {
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <GlobalHeader history={history}/>
            </ReduxProvider>,
        )

        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })
})
