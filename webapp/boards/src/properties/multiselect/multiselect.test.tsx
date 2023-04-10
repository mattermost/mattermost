// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {IntlProvider} from 'react-intl'
import {mocked} from 'jest-mock'

import {IPropertyOption, IPropertyTemplate, createBoard} from 'src/blocks/board'
import {createCard} from 'src/blocks/card'
import mutator from 'src/mutator'

import MultiSelectProperty from './property'
import MultiSelect from './multiselect'

jest.mock('src/mutator')
const mockedMutator = mocked(mutator)

function buildMultiSelectPropertyTemplate(options: IPropertyOption[] = []): IPropertyTemplate {
    return {
        id: 'multiselect-template-1',
        name: 'Multi',
        options: [
            {
                color: 'propColorDefault',
                id: 'multi-option-1',
                value: 'a',
            },
            {
                color: '',
                id: 'multi-option-2',
                value: 'b',
            },
            {
                color: 'propColorDefault',
                id: 'multi-option-3',
                value: 'c',
            },
            ...options,
        ],
        type: 'multiSelect',
    }
}

type WrapperProps = {
    children?: React.ReactNode
}

const Wrapper = ({children}: WrapperProps) => {
    return <IntlProvider locale='en'>{children}</IntlProvider>
}

describe('properties/multiSelect', () => {
    const nonEditableMultiSelectTestId = 'multiselect-non-editable'

    const board = createBoard()
    const card = createCard()

    const expectOptionsMenuToBeVisible = (template: IPropertyTemplate) => {
        for (const option of template.options) {
            expect(screen.getByRole('menuitem', {name: option.value})).toBeInTheDocument()
        }
    }

    beforeEach(() => {
        jest.resetAllMocks()
    })

    it('shows only the selected options when menu is not opened', () => {
        const propertyTemplate = buildMultiSelectPropertyTemplate()
        const propertyValue = ['multi-option-1', 'multi-option-2']

        const {container} = render(
            <MultiSelect
                property={new MultiSelectProperty()}
                readOnly={true}
                showEmptyPlaceholder={false}
                propertyTemplate={propertyTemplate}
                propertyValue={propertyValue}
                board={{...board}}
                card={{...card}}
            />,
            {wrapper: Wrapper},
        )

        const multiSelectParent = screen.getByTestId(nonEditableMultiSelectTestId)

        expect(multiSelectParent.children.length).toBe(propertyValue.length)

        expect(container).toMatchSnapshot()
    })

    it('opens editable multi value selector menu when the button/label is clicked', async () => {
        const propertyTemplate = buildMultiSelectPropertyTemplate()

        render(
            <MultiSelect
                property={new MultiSelectProperty()}
                readOnly={false}
                showEmptyPlaceholder={false}
                propertyTemplate={propertyTemplate}
                propertyValue={[]}
                board={{...board}}
                card={{...card}}
            />,
            {wrapper: Wrapper},
        )

        await userEvent.click(screen.getByTestId(nonEditableMultiSelectTestId))

        expect(screen.getByRole('combobox', {name: /value selector/i})).toBeInTheDocument()
    })

    it('can select a option', async () => {
        const propertyTemplate = buildMultiSelectPropertyTemplate()
        const propertyValue = ['multi-option-1']

        render(
            <MultiSelect
                property={new MultiSelectProperty()}
                readOnly={false}
                showEmptyPlaceholder={false}
                propertyTemplate={propertyTemplate}
                propertyValue={propertyValue}
                board={{...board}}
                card={{...card}}
            />,
            {wrapper: Wrapper},
        )

        await userEvent.click(screen.getByTestId(nonEditableMultiSelectTestId))

        await userEvent.type(screen.getByRole('combobox', {name: /value selector/i}), 'b{Enter}')

        expect(mockedMutator.changePropertyValue).toHaveBeenCalledWith(board.id, card, propertyTemplate.id, ['multi-option-1', 'multi-option-2'])
        expectOptionsMenuToBeVisible(propertyTemplate)
    })

    it('can unselect a option', async () => {
        const propertyTemplate = buildMultiSelectPropertyTemplate()
        const propertyValue = ['multi-option-1', 'multi-option-2']

        render(
            <MultiSelect
                property={new MultiSelectProperty()}
                readOnly={false}
                showEmptyPlaceholder={false}
                propertyTemplate={propertyTemplate}
                propertyValue={propertyValue}
                board={{...board}}
                card={{...card}}
            />,
            {wrapper: Wrapper},
        )

        await userEvent.click(screen.getByTestId(nonEditableMultiSelectTestId))

        await userEvent.click(screen.getAllByRole('button', {name: /clear/i})[0])

        expect(mockedMutator.changePropertyValue).toHaveBeenCalledWith(board.id, card, propertyTemplate.id, ['multi-option-2'])
        expectOptionsMenuToBeVisible(propertyTemplate)
    })

    it('can unselect a option via backspace', async () => {
        const propertyTemplate = buildMultiSelectPropertyTemplate()
        const propertyValue = ['multi-option-1', 'multi-option-2']

        render(
            <MultiSelect
                property={new MultiSelectProperty()}
                readOnly={false}
                showEmptyPlaceholder={false}
                propertyTemplate={propertyTemplate}
                propertyValue={propertyValue}
                board={{...board}}
                card={{...card}}
            />,
            {wrapper: Wrapper},
        )

        await userEvent.click(screen.getByTestId(nonEditableMultiSelectTestId))

        await userEvent.type(screen.getByRole('combobox', {name: /value selector/i}), '{backspace}')

        expect(mockedMutator.changePropertyValue).toHaveBeenCalledWith(board.id, card, propertyTemplate.id, ['multi-option-1'])
        expectOptionsMenuToBeVisible(propertyTemplate)
    })

    it('can close menu on escape', async () => {
        const propertyTemplate = buildMultiSelectPropertyTemplate()
        const propertyValue = ['multi-option-1', 'multi-option-2']

        render(
            <MultiSelect
                property={new MultiSelectProperty()}
                readOnly={false}
                showEmptyPlaceholder={false}
                propertyTemplate={propertyTemplate}
                propertyValue={propertyValue}
                board={{...board}}
                card={{...card}}
            />,
            {wrapper: Wrapper},
        )

        await userEvent.click(screen.getByTestId(nonEditableMultiSelectTestId))

        await userEvent.type(screen.getByRole('combobox', {name: /value selector/i}), '{escape}')

        for (const option of propertyTemplate.options) {
            expect(screen.queryByRole('menuitem', {name: option.value})).toBeNull()
        }
    })

    it('can create a new option', async () => {
        const propertyTemplate = buildMultiSelectPropertyTemplate()
        const propertyValue = ['multi-option-1', 'multi-option-2']

        render(
            <MultiSelect
                property={new MultiSelectProperty()}
                readOnly={false}
                showEmptyPlaceholder={false}
                propertyTemplate={propertyTemplate}
                propertyValue={propertyValue}
                board={{...board}}
                card={{...card}}
            />,
            {wrapper: Wrapper},
        )

        mockedMutator.insertPropertyOption.mockResolvedValue()

        await userEvent.click(screen.getByTestId(nonEditableMultiSelectTestId))
        await userEvent.type(screen.getByRole('combobox', {name: /value selector/i}), 'new-value{enter}')

        expect(mockedMutator.insertPropertyOption).toHaveBeenCalledWith(board.id, board.cardProperties, propertyTemplate, expect.objectContaining({value: 'new-value'}), 'add property option')
        expectOptionsMenuToBeVisible(propertyTemplate)
    })

    it('can delete a option', async () => {
        const propertyTemplate = buildMultiSelectPropertyTemplate()
        const propertyValue = ['multi-option-1', 'multi-option-2']

        render(
            <MultiSelect
                property={new MultiSelectProperty()}
                readOnly={false}
                showEmptyPlaceholder={false}
                propertyTemplate={propertyTemplate}
                propertyValue={propertyValue}
                board={{...board}}
                card={{...card}}
            />,
            {wrapper: Wrapper},
        )

        await userEvent.click(screen.getByTestId(nonEditableMultiSelectTestId))

        await userEvent.click(screen.getAllByRole('button', {name: /open menu/i})[0])

        await userEvent.click(screen.getByRole('button', {name: /delete/i}))

        const optionToDelete = propertyTemplate.options.find((option: IPropertyOption) => option.id === propertyValue[0])

        expect(mockedMutator.deletePropertyOption).toHaveBeenCalledWith(board.id, board.cardProperties, propertyTemplate, optionToDelete)
    })

    it('can change color for any option', async () => {
        const propertyTemplate = buildMultiSelectPropertyTemplate()
        const propertyValue = ['multi-option-1', 'multi-option-2']
        const newColorKey = 'propColorYellow'
        const newColorValue = 'yellow'

        render(
            <MultiSelect
                property={new MultiSelectProperty()}
                readOnly={false}
                showEmptyPlaceholder={false}
                propertyTemplate={propertyTemplate}
                propertyValue={propertyValue}
                board={{...board}}
                card={{...card}}
            />,
            {wrapper: Wrapper},
        )

        await userEvent.click(screen.getByTestId(nonEditableMultiSelectTestId))

        await userEvent.click(screen.getAllByRole('button', {name: /open menu/i})[0])

        await userEvent.click(screen.getByRole('button', {name: new RegExp(newColorValue, 'i')}))

        const selectedOption = propertyTemplate.options.find((option: IPropertyOption) => option.id === propertyValue[0])

        expect(mockedMutator.changePropertyOptionColor).toHaveBeenCalledWith(board.id, board.cardProperties, propertyTemplate, selectedOption, newColorKey)
    })
})
