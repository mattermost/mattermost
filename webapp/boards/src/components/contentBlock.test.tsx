// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, render, screen} from '@testing-library/react'

import React, {ReactElement, ReactNode} from 'react'
import {mocked} from 'jest-mock'
import {Provider as ReduxProvider} from 'react-redux'

import userEvent from '@testing-library/user-event'

import {Utils} from 'src/utils'
import {TestBlockFactory} from 'src/test/testBlockFactory'
import {mockDOM, mockStateStore, wrapDNDIntl} from 'src/testUtils'

import mutator from 'src/mutator'

import octoClient from 'src/octoClient'

import ContentBlock from './contentBlock'
import {CardDetailContext, CardDetailContextType} from './cardDetail/cardDetailContext'

jest.mock('src/mutator')
jest.mock('src/utils')
jest.mock('src/octoClient')
jest.mock('draft-js/lib/generateRandomKey', () => () => '123')

beforeAll(mockDOM)

describe('components/contentBlock', () => {
    const mockedMutator = mocked(mutator)
    const mockedUtils = mocked(Utils)
    const mockedOcto = mocked(octoClient)

    mockedUtils.createGuid.mockReturnValue('test-id')
    mockedOcto.getFileAsDataUrl.mockResolvedValue({url: 'test.jpg'})

    const board = TestBlockFactory.createBoard()
    board.cardProperties = []
    board.id = 'board-id'
    const boardView = TestBlockFactory.createBoardView(board)
    boardView.id = board.id
    const card = TestBlockFactory.createCard(board)
    card.id = board.id
    card.createdBy = 'user-id-1'
    const textBlock = TestBlockFactory.createText(card)
    textBlock.id = 'textBlock-id'
    const dividerBlock = TestBlockFactory.createDivider(card)
    dividerBlock.id = 'dividerBlock-id'
    const imageBlock = TestBlockFactory.createImage(card)
    imageBlock.fields.fileId = 'test.jpg'
    imageBlock.id = 'imageBlock-id'
    const commentBlock = TestBlockFactory.createComment(card)
    commentBlock.id = 'commentBlock-id'

    card.fields.contentOrder = [textBlock.id, dividerBlock.id, commentBlock.id]
    const cardDetailContextValue = (autoAdded: boolean): CardDetailContextType => ({
        card,
        lastAddedBlock: {
            id: textBlock.id,
            autoAdded,
        },
        deleteBlock: jest.fn(),
        addBlock: jest.fn(),
    })

    const board1 = TestBlockFactory.createBoard()
    board1.id = 'board-id-1'

    const state = {
        users: {
            boardUsers: {
                1: {username: 'abc'},
                2: {username: 'd'},
                3: {username: 'e'},
                4: {username: 'f'},
                5: {username: 'g'},
            },
        },
        boards: {
            current: 'board-id-1',
            boards: {
                [board1.id]: board1,
            },
        },
        clientConfig: {
            value: {},
        },
    }
    const store = mockStateStore([], state)

    const wrap = (child: ReactNode): ReactElement => (
        wrapDNDIntl(
            <ReduxProvider store={store}>
                <CardDetailContext.Provider value={cardDetailContextValue(true)}>
                    {child}
                </CardDetailContext.Provider>
            </ReduxProvider>,
        )
    )

    beforeEach(jest.clearAllMocks)

    test('should match snapshot with textBlock', async () => {
        let container
        await act(async () => {
            const result = render(wrap(
                <ContentBlock
                    block={textBlock}
                    card={card}
                    readonly={false}
                    onDrop={jest.fn()}
                    width={undefined}
                    cords={{x: 1, y: 0, z: 0}}
                />,
            ))
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot with dividerBlock', async () => {
        let container
        await act(async () => {
            const result = render(wrap(
                <ContentBlock
                    block={dividerBlock}
                    card={card}
                    readonly={false}
                    onDrop={jest.fn()}
                    width={undefined}
                    cords={{x: 1, y: 0, z: 0}}
                />,
            ))
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot with commentBlock', async () => {
        let container
        await act(async () => {
            const result = render(wrap(
                <ContentBlock
                    block={commentBlock}
                    card={card}
                    readonly={false}
                    onDrop={jest.fn()}
                    width={undefined}
                    cords={{x: 1, y: 0, z: 0}}
                />,
            ))
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot with imageBlock', async () => {
        let container
        await act(async () => {
            const result = render(wrap(
                <ContentBlock
                    block={imageBlock}
                    card={card}
                    readonly={false}
                    onDrop={jest.fn()}
                    width={undefined}
                    cords={{x: 1, y: 0, z: 0}}
                />,
            ))
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot with commentBlock readonly', async () => {
        let container
        await act(async () => {
            const result = render(wrap(
                <ContentBlock
                    block={commentBlock}
                    card={card}
                    readonly={true}
                    onDrop={jest.fn()}
                    width={undefined}
                    cords={{x: 1, y: 0, z: 0}}
                />,
            ))
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })

    test('return commentBlock and click on menuwrapper', async () => {
        let container
        await act(async () => {
            const result = render(wrap(
                <ContentBlock
                    block={commentBlock}
                    card={card}
                    readonly={false}
                    onDrop={jest.fn()}
                    width={undefined}
                    cords={{x: 1, y: 0, z: 0}}
                />,
            ))
            container = result.container
        })
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        await userEvent.click(buttonElement)

        expect(container).toMatchSnapshot()
    })

    test('return commentBlock and click move up', async () => {
        await act(async () => {
            render(wrap(
                <ContentBlock
                    block={commentBlock}
                    card={card}
                    readonly={false}
                    onDrop={jest.fn()}
                    width={undefined}
                    cords={{x: 1, y: 0, z: 0}}
                />,
            ))
        })
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        await userEvent.click(buttonElement)
        const buttonMoveUp = screen.getByRole('button', {name: 'Move up'})
        await userEvent.click(buttonMoveUp)
        expect(mockedUtils.arrayMove).toBeCalledTimes(1)
        expect(mockedMutator.changeCardContentOrder).toBeCalledTimes(1)
    })

    test('return commentBlock and click move down', async () => {
        await act(async () => {
            render(wrap(
                <ContentBlock
                    block={commentBlock}
                    card={card}
                    readonly={false}
                    onDrop={jest.fn()}
                    width={undefined}
                    cords={{x: 1, y: 0, z: 0}}
                />,
            ))
        })
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        await userEvent.click(buttonElement)
        const buttonMoveUp = screen.getByRole('button', {name: 'Move down'})
        await userEvent.click(buttonMoveUp)
        expect(mockedUtils.arrayMove).toBeCalledTimes(1)
        expect(mockedMutator.changeCardContentOrder).toBeCalledTimes(1)
    })

    test('return commentBlock and click delete', async () => {
        await act(async () => {
            render(wrap(
                <ContentBlock
                    block={commentBlock}
                    card={card}
                    readonly={false}
                    onDrop={jest.fn()}
                    width={undefined}
                    cords={{x: 1, y: -1, z: 0}}
                />,
            ))
        })
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        await userEvent.click(buttonElement)
        const buttonMoveUp = screen.getByRole('button', {name: 'Delete'})
        await userEvent.click(buttonMoveUp)
        expect(mockedMutator.performAsUndoGroup).toBeCalledTimes(1)
    })

    test('return commentBlock and click delete with another contentOrder', async () => {
        card.fields.contentOrder = [[textBlock.id], [dividerBlock.id], [commentBlock.id]]
        await act(async () => {
            render(wrap(
                <ContentBlock
                    block={commentBlock}
                    card={card}
                    readonly={false}
                    onDrop={jest.fn()}
                    width={undefined}
                    cords={{x: 1, y: 0, z: 0}}
                />,
            ))
        })
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        await userEvent.click(buttonElement)
        const buttonMoveUp = screen.getByRole('button', {name: 'Delete'})
        await userEvent.click(buttonMoveUp)
        expect(mockedMutator.performAsUndoGroup).toBeCalledTimes(1)
    })
})
