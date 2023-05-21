// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactElement, ReactNode} from 'react'
import {
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react'
import {mocked} from 'jest-mock'
import userEvent from '@testing-library/user-event'

import {wrapIntl} from 'src/testUtils'
import {ContentBlock, createContentBlock} from 'src/blocks/contentBlock'
import {CardDetailContext, CardDetailContextType, CardDetailProvider} from 'src/components/cardDetail/cardDetailContext'
import {TestBlockFactory} from 'src/test/testBlockFactory'
import mutator from 'src/mutator'

import CheckboxElement from './checkboxElement'

jest.mock('src/mutator')
const mockedMutator = mocked(mutator)

const board = TestBlockFactory.createBoard()
const card = TestBlockFactory.createCard(board)
const checkboxBlock: ContentBlock = {
    id: 'test-id',
    boardId: board.id,
    parentId: card.id,
    modifiedBy: 'test-user-id',
    schema: 1,
    type: 'checkbox',
    title: 'test-title',
    fields: {value: false},
    createdBy: 'test-user-id',
    createAt: 0,
    updateAt: 0,
    deleteAt: 0,
    limited: false,
}

const cardDetailContextValue = (autoAdded: boolean): CardDetailContextType => ({
    card,
    lastAddedBlock: {
        id: checkboxBlock.id,
        autoAdded,
    },
    deleteBlock: jest.fn(),
    addBlock: jest.fn(),
})

const wrap = (child: ReactNode): ReactElement => (
    wrapIntl(
        <CardDetailProvider card={card}>
            {child}
        </CardDetailProvider>,
    )
)

describe('components/content/checkboxElement', () => {
    beforeEach(jest.clearAllMocks)

    it('should match snapshot', () => {
        const component = wrap(
            <CheckboxElement
                block={checkboxBlock}
                readonly={false}
            />,
        )
        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })

    it('should match snapshot when read only', () => {
        const component = wrap(
            <CheckboxElement
                block={checkboxBlock}
                readonly={true}
            />,
        )
        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })

    it('should change title', async () => {
        const {container} = render(wrap(
            <CheckboxElement
                block={checkboxBlock}
                readonly={false}
            />,
        ))
        const newTitle = 'new title'
        const input = screen.getByRole('textbox', {name: /test-title/i})
        await userEvent.clear(input)
        await userEvent.type(input, newTitle)
        fireEvent.blur(input)
        expect(container).toMatchSnapshot()
        expect(mockedMutator.changeBlockTitle).toHaveBeenCalledTimes(1)
        expect(mockedMutator.changeBlockTitle).toHaveBeenCalledWith(
            checkboxBlock.boardId,
            checkboxBlock.id,
            checkboxBlock.title,
            newTitle,
            expect.anything())
    })

    it('should toggle value', async () => {
        const {container} = render(wrap(
            <CheckboxElement
                block={checkboxBlock}
                readonly={false}
            />,
        ))
        const input = screen.getByRole('checkbox')
        await userEvent.click(input)
        expect(container).toMatchSnapshot()
        expect(mockedMutator.updateBlock).toHaveBeenCalledTimes(1)
        expect(mockedMutator.updateBlock).toHaveBeenCalledWith(
            checkboxBlock.boardId,
            expect.objectContaining({fields: {value: true}}),
            checkboxBlock,
            expect.anything())
    })

    it('should have focus when last added', () => {
        render(wrapIntl(
            <CardDetailContext.Provider value={cardDetailContextValue(false)}>
                <CheckboxElement
                    block={checkboxBlock}
                    readonly={false}
                />
            </CardDetailContext.Provider>,
        ))
        const input = screen.getByRole('textbox', {name: /test-title/i})
        expect(input).toHaveFocus()
    })

    it('should add new checkbox when enter pressed', async () => {
        const addElement = jest.fn()
        render(wrap(
            <CheckboxElement
                block={checkboxBlock}
                readonly={false}
                onAddElement={addElement}
            />,
        ))
        const input = screen.getByRole('textbox', {name: /test-title/i})

        // should not add new checkbox when current one has empty title
        await userEvent.clear(input)
        await userEvent.type(input, '{Enter}')
        expect(addElement).toHaveBeenCalledTimes(0)

        // should add new checkbox when current one has non-empty title
        await userEvent.clear(input)
        await userEvent.type(input, 'new-title{Enter}')
        await waitFor(() => expect(addElement).toHaveBeenCalledTimes(1))
    })

    it('should delete automatically added checkbox with empty title on esc/enter pressed', async () => {
        const addedBlock = createContentBlock(checkboxBlock)
        addedBlock.title = ''
        const deleteElement = jest.fn()

        render(wrapIntl(
            <CardDetailContext.Provider value={cardDetailContextValue(true)}>
                <CheckboxElement
                    block={addedBlock}
                    readonly={false}
                    onDeleteElement={deleteElement}
                />
            </CardDetailContext.Provider>,
        ))
        const input = screen.getByRole('textbox')

        // should delete if title is empty
        await userEvent.type(input, '{Escape}')
        expect(deleteElement).toHaveBeenCalledTimes(1)
        await userEvent.type(input, '{Enter}')
        expect(deleteElement).toHaveBeenCalledTimes(2)

        // should not delete if title is not empty
        await userEvent.type(input, 'new-title{Enter}')
        expect(deleteElement).toHaveBeenCalledTimes(2)
    })
})
