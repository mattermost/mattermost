// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {act, render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React, {ReactElement, ReactNode} from 'react'
import {Provider as ReduxProvider} from 'react-redux'

import {wrapIntl, mockStateStore} from 'src/testUtils'

import {TestBlockFactory} from 'src/test/testBlockFactory'

import CardDetailContentsMenu from './cardDetailContentsMenu'

//for contentRegistry
import 'src/components/content/textElement'
import 'src/components/content/imageElement'
import 'src/components/content/dividerElement'
import 'src/components/content/checkboxElement'
import {CardDetailProvider} from './cardDetailContext'

jest.mock('src/mutator')

const board = TestBlockFactory.createBoard()
const card = TestBlockFactory.createCard(board)
describe('components/cardDetail/cardDetailContentsMenu', () => {
    const store = mockStateStore([], {})
    const wrap = (child: ReactNode): ReactElement => (
        wrapIntl(
            <ReduxProvider store={store}>
                <CardDetailProvider card={card}>
                    {child}
                </CardDetailProvider>
            </ReduxProvider>,
        )
    )
    beforeEach(() => {
        jest.clearAllMocks()
    })
    test('return cardDetailContentsMenu', () => {
        const {container} = render(wrap(<CardDetailContentsMenu/>))
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
    })

    test('return cardDetailContentsMenu and add Text content', async () => {
        const {container} = render(wrap(<CardDetailContentsMenu/>))
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        await act(async () => {
            const buttonAddText = screen.getByRole('button', {name: 'text'})
            userEvent.click(buttonAddText)
        })
        expect(container).toMatchSnapshot()
    })
})
