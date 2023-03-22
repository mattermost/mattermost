// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'

import {render, screen} from '@testing-library/react'
import '@testing-library/jest-dom'

import {TestBlockFactory} from 'src/test/testBlockFactory'
import {blocksById, mockStateStore, wrapDNDIntl} from 'src/testUtils'

import {RootState} from 'src/store'

import {CommentBlock} from 'src/blocks/commentBlock'

import {CheckboxBlock} from 'src/blocks/checkboxBlock'

import CardBadges from './cardBadges'

describe('components/cardBadges', () => {
    const board = TestBlockFactory.createBoard()
    const card = TestBlockFactory.createCard(board)
    const emptyCard = TestBlockFactory.createCard(board)
    const text = TestBlockFactory.createText(card)
    text.title = `
                ## Header
                - [x] one
                - [ ] two
                - [x] three
   `.replace(/\n\s+/gm, '\n')
    const comments = Array.from(Array<CommentBlock>(3), () => TestBlockFactory.createComment(card))
    const checkboxes = Array.from(Array<CheckboxBlock>(4), () => TestBlockFactory.createCheckbox(card))
    checkboxes[2].fields.value = true

    const state: Partial<RootState> = {
        cards: {
            current: '',
            limitTimestamp: 0,
            cards: blocksById([card, emptyCard]),
            templates: {},
            cardHiddenWarning: true,
        },
        comments: {
            comments: blocksById(comments),
            commentsByCard: {
                [card.id]: comments,
            },
        },
        contents: {
            contents: {
                ...blocksById([text]),
                ...blocksById(checkboxes),
            },
            contentsByCard: {
                [card.id]: [text, ...checkboxes],
            },
        },
    }
    const store = mockStateStore([], state)

    it('should match snapshot', () => {
        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <CardBadges card={card}/>
            </ReduxProvider>,
        ))
        expect(container).toMatchSnapshot()
    })

    it('should match snapshot for empty card', () => {
        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <CardBadges card={emptyCard}/>
            </ReduxProvider>,
        ))
        expect(container).toMatchSnapshot()
    })

    it('should render correct values', () => {
        render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <CardBadges card={card}/>
            </ReduxProvider>,
        ))
        expect(screen.getByTitle(/card has a description/)).toBeInTheDocument()
        expect(screen.getByTitle('Comments')).toHaveTextContent('3')
        expect(screen.getByTitle('Checkboxes')).toHaveTextContent('3/7')
    })
})
