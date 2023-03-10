// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {render} from '@testing-library/react'

import {TestBlockFactory} from 'src/test/testBlockFactory'

import {wrapIntl} from 'src/testUtils'

import {KanbanCalculation} from './calculation'

describe('components/kanban/calculation/KanbanCalculation', () => {
    const board = TestBlockFactory.createBoard()
    const cards = [
        TestBlockFactory.createCard(board),
        TestBlockFactory.createCard(board),
        TestBlockFactory.createCard(board),
    ]

    test('base case', () => {
        const component = wrapIntl((
            <KanbanCalculation
                cards={cards}
                cardProperties={board.cardProperties}
                menuOpen={false}
                onMenuClose={() => {}}
                onMenuOpen={() => {}}
                onChange={() => {}}
                value={'count'}
                property={board.cardProperties[0]}
                readonly={false}
            />
        ))

        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })

    test('calculations menu open', () => {
        const component = wrapIntl((
            <KanbanCalculation
                cards={cards}
                cardProperties={board.cardProperties}
                menuOpen={true}
                onMenuClose={() => {}}
                onMenuOpen={() => {}}
                onChange={() => {}}
                value={'count'}
                property={board.cardProperties[0]}
                readonly={false}
            />
        ))

        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })

    test('no menu should appear in readonly mode', () => {
        const component = wrapIntl((
            <KanbanCalculation
                cards={cards}
                cardProperties={board.cardProperties}
                menuOpen={true}
                onMenuClose={() => {}}
                onMenuOpen={() => {}}
                onChange={() => {}}
                value={'count'}
                property={board.cardProperties[0]}
                readonly={true}
            />
        ))

        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })
})
