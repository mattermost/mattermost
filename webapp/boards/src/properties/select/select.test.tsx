// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {render, screen} from '@testing-library/react'
import {mocked} from 'jest-mock'

import {IPropertyTemplate, createBoard} from 'src/blocks/board'
import {createCard} from 'src/blocks/card'

import {setup, wrapIntl} from 'src/testUtils'
import mutator from 'src/mutator'

import SelectProperty from './property'
import Select from './select'

jest.mock('src/mutator')
const mockedMutator = mocked(mutator)

function selectPropertyTemplate(): IPropertyTemplate {
    return {
        id: 'select-template',
        name: 'select',
        type: 'select',
        options: [
            {
                id: 'option-1',
                value: 'one',
                color: 'propColorDefault',
            },
            {
                id: 'option-2',
                value: 'two',
                color: 'propColorGreen',
            },
            {
                id: 'option-3',
                value: 'three',
                color: 'propColorRed',
            },
        ],
    }
}

describe('properties/select', () => {
    const nonEditableSelectTestId = 'select-non-editable'

    const clearButton = () => screen.queryByRole('button', {name: /clear/i})
    let board: ReturnType<typeof createBoard>
    let card: ReturnType<typeof createCard>

    beforeEach(() => {
        board = createBoard()
        card = createCard()
    })

    it('shows the selected option', () => {
        const propertyTemplate = selectPropertyTemplate()
        const option = propertyTemplate.options[0]

        const {container} = render(wrapIntl(
            <Select
                property={new SelectProperty()}
                board={{...board}}
                card={{...card}}
                propertyTemplate={propertyTemplate}
                propertyValue={option.id}
                readOnly={true}
                showEmptyPlaceholder={false}
            />,
        ))

        expect(screen.getByText(option.value)).toBeInTheDocument()
        expect(clearButton()).not.toBeInTheDocument()

        expect(container).toMatchSnapshot()
    })

    it('shows empty placeholder', () => {
        const propertyTemplate = selectPropertyTemplate()
        const emptyValue = 'Empty'

        const {container} = setup(wrapIntl(
            <Select
                property={new SelectProperty()}
                board={{...board}}
                card={{...card}}
                showEmptyPlaceholder={true}
                propertyTemplate={propertyTemplate}
                propertyValue={''}
                readOnly={true}
            />,
        ))

        expect(screen.getByText(emptyValue)).toBeInTheDocument()
        expect(clearButton()).not.toBeInTheDocument()

        expect(container).toMatchSnapshot()
    })

    it('shows the menu with options when preview is clicked', async () => {
        const propertyTemplate = selectPropertyTemplate()
        const selected = propertyTemplate.options[1]

        const {user} = setup(wrapIntl(
            <Select
                property={new SelectProperty()}
                board={{...board}}
                card={{...card}}
                propertyTemplate={propertyTemplate}
                propertyValue={selected.id}
                showEmptyPlaceholder={false}
                readOnly={false}
            />,
        ))

        await user.click(screen.getByTestId(nonEditableSelectTestId))

        // check that all options are visible
        for (const option of propertyTemplate.options) {
            const elements = screen.getAllByText(option.value)

            // selected option is rendered twice: in the input and inside the menu
            const expected = option.id === selected.id ? 2 : 1
            expect(elements.length).toBe(expected)
        }

        expect(clearButton()).toBeInTheDocument()
    })

    it('can select the option from menu', async () => {
        const propertyTemplate = selectPropertyTemplate()
        const optionToSelect = propertyTemplate.options[2]

        const {user} = setup(wrapIntl(
            <Select
                property={new SelectProperty()}
                board={{...board}}
                card={{...card}}
                propertyTemplate={propertyTemplate}
                propertyValue={''}
                showEmptyPlaceholder={false}
                readOnly={false}
            />,
        ))

        await user.click(screen.getByTestId(nonEditableSelectTestId))
        await user.click(screen.getByText(optionToSelect.value))

        expect(clearButton()).not.toBeInTheDocument()
        expect(mockedMutator.changePropertyValue).toHaveBeenCalledWith(board.id, card, propertyTemplate.id, optionToSelect.id)
    })

    it('can clear the selected option', async () => {
        const propertyTemplate = selectPropertyTemplate()
        const selected = propertyTemplate.options[1]

        const {user} = setup(wrapIntl(
            <Select
                property={new SelectProperty()}
                board={{...board}}
                card={{...card}}
                propertyTemplate={propertyTemplate}
                propertyValue={selected.id}
                showEmptyPlaceholder={false}
                readOnly={false}
            />,
        ))

        await user.click(screen.getByTestId(nonEditableSelectTestId))

        const clear = clearButton()
        expect(clear).toBeInTheDocument()
        await user.click(clear!)

        expect(mockedMutator.changePropertyValue).toHaveBeenCalledWith(board.id, card, propertyTemplate.id, '')
    })

    // TODO fix this test

    it.skip('can create new option', async () => {
        const propertyTemplate = selectPropertyTemplate()
        const initialOption = propertyTemplate.options[0]
        const newOption = 'new-option'

        const {user} = setup(wrapIntl(
            <Select
                property={new SelectProperty()}
                board={{...board}}
                card={{...card}}
                propertyTemplate={propertyTemplate}
                propertyValue={initialOption.id}
                showEmptyPlaceholder={false}
                readOnly={false}
            />,
        ))

        mockedMutator.insertPropertyOption.mockResolvedValue()
        await user.click(screen.getByTestId(nonEditableSelectTestId))
        await user.type(screen.getByRole('combobox', {name: /value selector/i}), `${newOption}{Enter}`)
        expect(mockedMutator.insertPropertyOption).toHaveBeenCalledWith(board.id, board.cardProperties, propertyTemplate, expect.objectContaining({value: newOption}), 'add property option')
        expect(mockedMutator.changePropertyValue).toHaveBeenCalledWith(board.id, card, propertyTemplate.id, 'option-3')
    })
})
