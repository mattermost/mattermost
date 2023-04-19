// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {render} from '@testing-library/react'
import React from 'react'

import {TestBlockFactory} from 'src/test/testBlockFactory'
import {wrapDNDIntl} from 'src/testUtils'

import ShareBoardLoginButton from './shareBoardLoginButton'
jest.useFakeTimers()

const boardId = '1'

const board = TestBlockFactory.createBoard()
board.id = boardId

jest.mock('react-router-dom', () => {
    const originalModule = jest.requireActual('react-router-dom')

    return {
        ...originalModule,
        useRouteMatch: jest.fn(() => {
            return {
                params: {
                    teamId: 'team1',
                    boardId: 'boardId1',
                    viewId: 'viewId1',
                    cardId: 'cardId1',
                },
            }
        }),
    }
})

describe('src/components/shareBoard/shareBoardLoginButton', () => {
    const savedLocation = window.location

    afterEach(() => {
        window.location = savedLocation
    })

    test('should match snapshot', async () => {
        // delete window.location
        window.location = Object.assign(new URL('https://example.org/mattermost'))
        const result = render(
            wrapDNDIntl(
                <ShareBoardLoginButton/>,
            ))
        const renderer = result.container

        expect(renderer).toMatchSnapshot()
    })
})
