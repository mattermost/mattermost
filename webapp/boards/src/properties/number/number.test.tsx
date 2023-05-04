// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps} from 'react'
import {screen} from '@testing-library/react'
import {mocked} from 'jest-mock'

import {setup, wrapIntl} from 'src/testUtils'
import {TestBlockFactory} from 'src/test/testBlockFactory'
import mutator from 'src/mutator'

import {Board, IPropertyTemplate} from 'src/blocks/board'
import {Card} from 'src/blocks/card'

import NumberProperty from './property'
import NumberEditor from './number'

jest.mock('src/components/flashMessages')
jest.mock('src/mutator')

const mockedMutator = mocked(mutator)

describe('properties/number', () => {
    let board: Board
    let card: Card
    let propertyTemplate: IPropertyTemplate
    let baseProps: ComponentProps<typeof NumberEditor>

    beforeEach(() => {
        board = TestBlockFactory.createBoard()
        card = TestBlockFactory.createCard()
        propertyTemplate = board.cardProperties[0]

        baseProps = {
            property: new NumberProperty(),
            card,
            board,
            propertyTemplate,
            propertyValue: '',
            readOnly: false,
            showEmptyPlaceholder: false,
        }
    })

    it('should match snapshot for number with empty value', () => {
        const {container} = setup(
            wrapIntl((
                <NumberEditor
                    {...baseProps}
                />
            ))
        )
        expect(container).toMatchSnapshot()
    })

    it('should fire change event when valid number value is entered', async () => {
        const {user} = setup(
            wrapIntl(
                <NumberEditor
                    {...baseProps}
                />
            )
        )
        const value = '42'
        const input = screen.getByRole('textbox')
        await user.type(input, `${value}{Enter}`)

        expect(mockedMutator.changePropertyValue).toHaveBeenCalledWith(board.id, card, propertyTemplate.id, `${value}`)
    })
})
