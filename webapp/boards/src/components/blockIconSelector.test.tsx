// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {
    fireEvent,
    render,
    screen,
    act
} from '@testing-library/react'

import userEvent from '@testing-library/user-event'

import '@testing-library/jest-dom'

import {mocked} from 'jest-mock'

import mutator from 'src/mutator'

import {wrapIntl} from 'src/testUtils'

import {TestBlockFactory} from 'src/test/testBlockFactory'

import BlockIconSelector from './blockIconSelector'

const card = TestBlockFactory.createCard()
const icon = '👍'

jest.mock('src/mutator')
const mockedMutator = mocked(mutator, true)

describe('components/blockIconSelector', () => {
    beforeEach(() => {
        card.fields.icon = icon
        jest.clearAllMocks()
    })
    test('return an icon correctly', () => {
        const {container} = render(wrapIntl(
            <BlockIconSelector
                block={card}
                size='l'
            />,
        ))
        expect(container).toMatchSnapshot()
    })
    test('return no element with no icon', () => {
        card.fields.icon = ''
        const {container} = render(wrapIntl(
            <BlockIconSelector
                block={card}
                size='l'
            />,
        ))
        expect(container).toMatchSnapshot()
    })
    test('return menu on click', () => {
        const {container} = render(wrapIntl(
            <BlockIconSelector
                block={card}
                size='l'
            />,
        ))
        userEvent.click(screen.getByRole('button', {name: 'menuwrapper'}))
        expect(container).toMatchSnapshot()
    })
    test('return no menu in readonly', () => {
        const {container} = render(wrapIntl(
            <BlockIconSelector
                block={card}
                readonly={true}
            />,
        ))
        expect(container).toMatchSnapshot()
    })

    test('return a new icon after click on random menu', () => {
        render(wrapIntl(
            <BlockIconSelector
                block={card}
                size='l'
            />,
        ))
        userEvent.click(screen.getByRole('button', {name: 'menuwrapper'}))
        const buttonRandom = screen.queryByRole('button', {name: 'Random'})
        expect(buttonRandom).not.toBeNull()
        userEvent.click(buttonRandom!)
        expect(mockedMutator.changeBlockIcon).toBeCalledTimes(1)
    })

    test('return a new icon after click on EmojiPicker', () => {
        const {container, getByRole, getAllByRole} = render(wrapIntl(
            <BlockIconSelector
                block={card}
                size='l'
            />,
        ))
        act(() => {
            userEvent.click(getByRole('button', {name: 'menuwrapper'}))
        })
        const menuPicker = container.querySelector('div#pick')
        expect(menuPicker).not.toBeNull()

        act(() => {
            fireEvent.mouseEnter(menuPicker!)
        })

        const allButtonThumbUp = getAllByRole('button', {name: /thumbsup/i})
        userEvent.click(allButtonThumbUp[0])
        expect(mockedMutator.changeBlockIcon).toBeCalledTimes(1)
        expect(mockedMutator.changeBlockIcon).toBeCalledWith(card.boardId, card.id, card.fields.icon, '👍')
    })

    test('return no icon after click on remove menu', () => {
        const {container, rerender} = render(wrapIntl(
            <BlockIconSelector
                block={card}
                size='l'
            />,
        ))
        userEvent.click(screen.getByRole('button', {name: 'menuwrapper'}))
        const buttonRemove = screen.queryByRole('button', {name: 'Remove icon'})
        expect(buttonRemove).not.toBeNull()
        userEvent.click(buttonRemove!)
        expect(mockedMutator.changeBlockIcon).toBeCalledTimes(1)
        expect(mockedMutator.changeBlockIcon).toBeCalledWith(card.boardId, card.id, card.fields.icon, '', 'remove icon')

        //simulate reset icon
        card.fields.icon = ''

        rerender(wrapIntl(
            <BlockIconSelector
                block={card}
            />),
        )
        expect(container).toMatchSnapshot()
    })
})
