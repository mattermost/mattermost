// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import {render} from '@testing-library/react'

import {mockStateStore, wrapIntl} from 'src/testUtils'

import RHSChannelBoardsHeader from './rhsChannelBoardsHeader'

describe('components/rhsChannelBoardsHeader', () => {
    it('renders the header', async () => {
        const state = {
            language: {
                value: 'en',
            },
            channels: {
                current: {
                    id: 'channel-id',
                    name: 'channel',
                    display_name: 'Channel Name',
                    type: 'O',
                },
            },
        }
        const store = mockStateStore([], state)
        const {container} = render(wrapIntl(
            <ReduxProvider store={store}>
                <RHSChannelBoardsHeader/>
            </ReduxProvider>
        ))
        expect(container).toMatchSnapshot()
    })
})
