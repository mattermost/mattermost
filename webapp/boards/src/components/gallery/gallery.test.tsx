// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {fireEvent, render, screen} from '@testing-library/react'

import {Provider as ReduxProvider} from 'react-redux'

import userEvent from '@testing-library/user-event'

import {mocked} from 'jest-mock'

import {blocksById, mockStateStore, wrapDNDIntl} from 'src/testUtils'

import {TestBlockFactory} from 'src/test/testBlockFactory'

import mutator from 'src/mutator'

import Gallery from './gallery'

jest.mock('src/mutator')
const mockedMutator = mocked(mutator)

describe('src/components/gallery/Gallery', () => {
    const board = TestBlockFactory.createBoard()
    const activeView = TestBlockFactory.createBoardView(board)
    activeView.fields.sortOptions = []
    const card = TestBlockFactory.createCard(board)
    const card2 = TestBlockFactory.createCard(board)
    const contents = [TestBlockFactory.createDivider(card), TestBlockFactory.createDivider(card), TestBlockFactory.createDivider(card2)]
    const state = {
        contents: {
            contents: blocksById(contents),
            contentsByCard: {
                [card.id]: [contents[0], contents[1]],
                [card2.id]: [contents[2]],
            },
        },
        cards: {
            current: '',
            limitTimestamp: 0,
            cards: {
                [card.id]: card,
            },
            templates: {},
            cardHiddenWarning: true,
        },
        teams: {
            current: {id: 'team-id'},
        },
        boards: {
            current: board.id,
            boards: {
                [board.id]: board,
            },
            myBoardMemberships: {
                [board.id]: {userId: 'user_id_1', schemeAdmin: true},
            },
        },
        comments: {
            comments: {},
        },
        users: {
            me: {
                id: 'user_id_1',
                props: {},
            },
        },
    }
    const store = mockStateStore([], state)
    beforeEach(() => {
        jest.clearAllMocks()
    })
    test('should match snapshot', async () => {
        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <Gallery
                    board={board}
                    cards={[card, card2]}
                    activeView={activeView}
                    readonly={false}
                    addCard={jest.fn()}
                    selectedCardIds={[card.id]}
                    onCardClicked={jest.fn()}
                    hiddenCardsCount={0}
                    showHiddenCardCountNotification={jest.fn()}
                />
            </ReduxProvider>,
        ))
        const buttonElement = screen.getAllByRole('button', {name: 'menuwrapper'})[0]
        await userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
    })
    test('should match snapshot without permissions', async () => {
        const localStore = mockStateStore([], {...state, teams: {current: undefined}})
        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={localStore}>
                <Gallery
                    board={board}
                    cards={[card, card2]}
                    activeView={activeView}
                    readonly={false}
                    addCard={jest.fn()}
                    selectedCardIds={[card.id]}
                    onCardClicked={jest.fn()}
                    hiddenCardsCount={0}
                    showHiddenCardCountNotification={jest.fn()}
                />
            </ReduxProvider>,
        ))
        const buttonElement = screen.getAllByRole('button', {name: 'menuwrapper'})[0]
        await userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
    })
    test('return Gallery and click new', async () => {
        const mockAddCard = jest.fn()
        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <Gallery
                    board={board}
                    cards={[card, card2]}
                    activeView={activeView}
                    readonly={false}
                    addCard={mockAddCard}
                    selectedCardIds={[card.id]}
                    onCardClicked={jest.fn()}
                    hiddenCardsCount={0}
                    showHiddenCardCountNotification={jest.fn()}
                />
            </ReduxProvider>,
        ))
        expect(container).toMatchSnapshot()

        const elementNew = container.querySelector('.octo-gallery-new')!
        expect(elementNew).toBeDefined()
        await userEvent.click(elementNew)
        expect(mockAddCard).toBeCalledTimes(1)
    })

    test('return Gallery readonly', () => {
        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <Gallery
                    board={board}
                    cards={[card, card2]}
                    activeView={activeView}
                    readonly={true}
                    addCard={jest.fn()}
                    selectedCardIds={[card.id]}
                    onCardClicked={jest.fn()}
                    hiddenCardsCount={0}
                    showHiddenCardCountNotification={jest.fn()}
                />
            </ReduxProvider>,
        ))
        expect(container).toMatchSnapshot()
    })
    test('return Gallery and drag and drop card', async () => {
        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <Gallery
                    board={board}
                    cards={[card, card2]}
                    activeView={activeView}
                    readonly={false}
                    addCard={jest.fn()}
                    selectedCardIds={[]}
                    onCardClicked={jest.fn()}
                    hiddenCardsCount={0}
                    showHiddenCardCountNotification={jest.fn()}
                />
            </ReduxProvider>,
        ))
        const allGalleryCard = container.querySelectorAll('.GalleryCard')
        const drag = allGalleryCard[0]
        const drop = allGalleryCard[1]
        fireEvent.dragStart(drag)
        fireEvent.dragEnter(drop)
        fireEvent.dragOver(drop)
        fireEvent.drop(drop)
        expect(mockedMutator.performAsUndoGroup).toBeCalledTimes(1)
    })

    test('limited card count check', () => {
        const boardTest = TestBlockFactory.createBoard()
        const card1 = TestBlockFactory.createCard(boardTest)
        const card3 = TestBlockFactory.createCard(boardTest)
        const stateTest = {
            contents: {
                contents: blocksById(contents),
                contentsByCard: {
                    [card.id]: [contents[0], contents[1]],
                    [card2.id]: [contents[2]],
                },
            },
            cards: {
                current: '',
                cards: {
                    [card1.id]: card1,
                    [card3.id]: card3,
                },
                templates: {},
                cardHiddenWarning: true,
                limitTimestamp: 2,
            },
            users: {
                me: {
                    id: 'user_id_1',
                    props: {},
                },
            },
            teams: {
                current: {id: 'team-id'},
            },
            comments: {
                comments: {},
            },
            boards: {
                current: board.id,
                boards: {
                    [board.id]: board,
                },
                myBoardMemberships: {
                    [board.id]: {userId: 'user_id_1', schemeAdmin: true},
                },
            },
        }
        const storeTest = mockStateStore([], stateTest)
        const {container, getByTitle} = render(wrapDNDIntl(
            <ReduxProvider store={storeTest}>
                <Gallery
                    board={boardTest}
                    cards={[card1, card3]}
                    activeView={activeView}
                    readonly={false}
                    addCard={jest.fn()}
                    selectedCardIds={[card1.id]}
                    onCardClicked={jest.fn()}
                    hiddenCardsCount={2}
                    showHiddenCardCountNotification={jest.fn()}
                />
            </ReduxProvider>,
        ))
        expect(getByTitle('hidden-card-count').innerHTML).toBe('<span>2</span>')
        expect(container).toMatchSnapshot()
    })
})
