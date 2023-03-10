// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {act, render, screen} from '@testing-library/react'

import {Provider as ReduxProvider} from 'react-redux'

import userEvent from '@testing-library/user-event'

import {mocked} from 'jest-mock'

import {MockStoreEnhanced} from 'redux-mock-store'

import {wrapDNDIntl, mockStateStore} from 'src/testUtils'

import {TestBlockFactory} from 'src/test/testBlockFactory'

import mutator from 'src/mutator'

import {Utils} from 'src/utils'

import octoClient from 'src/octoClient'

import GalleryCard from './galleryCard'

jest.mock('src/mutator')
jest.mock('src/utils')
jest.mock('src/octoClient')

describe('src/components/gallery/GalleryCard', () => {
    const mockedMutator = mocked(mutator, true)
    const mockedUtils = mocked(Utils, true)
    const mockedOcto = mocked(octoClient, true)
    mockedOcto.getFileAsDataUrl.mockResolvedValue({url: 'test.jpg'})

    const board = TestBlockFactory.createBoard()
    board.id = 'boardId'

    const activeView = TestBlockFactory.createBoardView(board)
    activeView.fields.sortOptions = []

    const card = TestBlockFactory.createCard(board)
    card.id = 'cardId'

    const contentImage = TestBlockFactory.createImage(card)
    contentImage.id = 'contentId-image'
    contentImage.fields.fileId = 'test.jpg'

    const contentComment = TestBlockFactory.createComment(card)
    contentComment.id = 'contentId-Comment'

    let store: MockStoreEnhanced<unknown, unknown>

    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('without block content', () => {
        beforeEach(() => {
            const state = {
                contents: {
                    contents: {
                    },
                },
                cards: {
                    cards: {
                        [card.id]: card,
                    },
                },
                teams: {
                    current: {id: 'team-id'},
                },
                boards: {
                    current: board.id,
                    boards: {
                        [board.id]: board,
                    },
                    templates: [],
                    myBoardMemberships: {
                        [board.id]: {userId: 'user_id_1', schemeAdmin: true},
                    },
                },
                comments: {
                    comments: {},
                    commentsByCard: {},
                },
                users: {
                    me: {
                        id: 'user_id_1',
                        props: {},
                    },
                },
            }
            store = mockStateStore([], state)
        })
        test('should match snapshot', () => {
            const {container} = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <GalleryCard
                        board={board}
                        card={card}
                        onClick={jest.fn()}
                        visiblePropertyTemplates={[{id: card.id, name: 'testTemplateProperty', type: 'text', options: [{id: '1', value: 'testValue', color: 'blue'}]}]}
                        visibleTitle={true}
                        isSelected={true}
                        visibleBadges={false}
                        readonly={false}
                        isManualSort={true}
                        onDrop={jest.fn()}
                    />
                </ReduxProvider>,
            ))
            const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
            userEvent.click(buttonElement)
            expect(container).toMatchSnapshot()
        })
        test('return GalleryCard and click on it', () => {
            const mockedOnClick = jest.fn()
            const {container} = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <GalleryCard
                        board={board}
                        card={card}
                        onClick={mockedOnClick}
                        visiblePropertyTemplates={[]}
                        visibleTitle={true}
                        isSelected={true}
                        visibleBadges={false}
                        readonly={false}
                        isManualSort={true}
                        onDrop={jest.fn()}
                    />
                </ReduxProvider>,
            ))
            const galleryCardElement = container.querySelector('.GalleryCard')
            userEvent.click(galleryCardElement!)
            expect(mockedOnClick).toBeCalledTimes(1)
        })
        test('return GalleryCard and delete card', () => {
            const {container} = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <GalleryCard
                        board={board}
                        card={card}
                        onClick={jest.fn()}
                        visiblePropertyTemplates={[]}
                        visibleTitle={true}
                        isSelected={true}
                        visibleBadges={false}
                        readonly={false}
                        isManualSort={true}
                        onDrop={jest.fn()}
                    />
                </ReduxProvider>,
            ))
            const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
            userEvent.click(buttonElement)
            const buttonDelete = screen.getByRole('button', {name: 'Delete'})
            userEvent.click(buttonDelete)
            expect(container).toMatchSnapshot()
        })

        test('return GalleryCard and duplicate card', () => {
            const {container} = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <GalleryCard
                        board={board}
                        card={card}
                        onClick={jest.fn()}
                        visiblePropertyTemplates={[]}
                        visibleTitle={true}
                        isSelected={true}
                        visibleBadges={false}
                        readonly={false}
                        isManualSort={true}
                        onDrop={jest.fn()}
                    />
                </ReduxProvider>,
            ))
            const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
            userEvent.click(buttonElement)
            const buttonDuplicate = screen.getByRole('button', {name: 'Duplicate'})
            userEvent.click(buttonDuplicate)
            expect(container).toMatchSnapshot()
            expect(mockedMutator.duplicateCard).toBeCalledTimes(1)
            expect(mockedMutator.duplicateCard).toBeCalledWith(card.id, board.id)
        })
        test('return GalleryCard and copy link', () => {
            const {container} = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <GalleryCard
                        board={board}
                        card={card}
                        onClick={jest.fn()}
                        visiblePropertyTemplates={[]}
                        visibleTitle={true}
                        isSelected={true}
                        visibleBadges={false}
                        readonly={false}
                        isManualSort={true}
                        onDrop={jest.fn()}
                    />
                </ReduxProvider>,
            ))
            const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
            userEvent.click(buttonElement)
            const buttonCopyLink = screen.getByRole('button', {name: 'Copy link'})
            userEvent.click(buttonCopyLink)
            expect(container).toMatchSnapshot()
            expect(mockedUtils.copyTextToClipboard).toBeCalledTimes(1)
        })
        test('return GalleryCard and cancel', () => {
            const {container} = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <GalleryCard
                        board={board}
                        card={card}
                        onClick={jest.fn()}
                        visiblePropertyTemplates={[]}
                        visibleTitle={true}
                        isSelected={true}
                        visibleBadges={false}
                        readonly={false}
                        isManualSort={true}
                        onDrop={jest.fn()}
                    />
                </ReduxProvider>,
            ))
            const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
            userEvent.click(buttonElement)
            const buttonCancel = screen.getByRole('button', {name: 'Cancel'})
            userEvent.click(buttonCancel)
            expect(container).toMatchSnapshot()
        })
    })
    describe('with an image content', () => {
        beforeEach(() => {
            card.fields.contentOrder = [contentImage.id]
            const state = {
                contents: {
                    contents: {
                        [contentImage.id]: contentImage,
                    },
                    contentsByCard: {
                        [card.id]: [contentImage],
                    },
                },
                cards: {
                    cards: {
                        [card.id]: card,
                    },
                },
                comments: {
                    comments: {},
                    commentsByCard: {},
                },
                teams: {
                    current: {id: 'team-id'},
                },
                boards: {
                    current: board.id,
                    boards: {
                        [board.id]: board,
                    },
                    templates: [],
                    myBoardMemberships: {
                        [board.id]: {userId: 'user_id_1', schemeAdmin: true},
                    },
                },
                users: {
                    me: {
                        id: 'user_id_1',
                        props: {},
                    },
                },
            }
            store = mockStateStore([], state)
        })
        test('should match snapshot', async () => {
            const {container} = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <GalleryCard
                        board={board}
                        card={card}
                        onClick={jest.fn()}
                        visiblePropertyTemplates={[]}
                        visibleTitle={true}
                        isSelected={true}
                        visibleBadges={false}
                        readonly={false}
                        isManualSort={true}
                        onDrop={jest.fn()}
                    />
                </ReduxProvider>,
            ))
            await act(async () => {
                const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
                userEvent.click(buttonElement)
            })
            expect(container).toMatchSnapshot()
        })
    })

    describe('with many images content', () => {
        beforeEach(() => {
            const contentImage2 = TestBlockFactory.createImage(card)
            contentImage2.id = 'contentId-image2'
            contentImage2.fields.fileId = 'test2.jpg'
            card.fields.contentOrder = [contentImage.id, contentImage2.id]
            const state = {
                contents: {
                    contents: {
                        [contentImage.id]: [contentImage],
                        [contentImage2.id]: [contentImage2],
                    },
                    contentsByCard: {
                        [card.id]: [contentImage, contentImage2],
                    },
                },
                cards: {
                    cards: {
                        [card.id]: card,
                    },
                },
                comments: {
                    comments: {},
                    commentsByCard: {},
                },
                teams: {
                    current: {id: 'team-id'},
                },
                boards: {
                    current: board.id,
                    boards: {
                        [board.id]: board,
                    },
                    templates: [],
                    myBoardMemberships: {
                        [board.id]: {userId: 'user_id_1', schemeAdmin: true},
                    },
                },
                users: {
                    me: {
                        id: 'user_id_1',
                        props: {},
                    },
                },
            }
            store = mockStateStore([], state)
        })
        test('should match snapshot with only first image', async () => {
            const {container} = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <GalleryCard
                        board={board}
                        card={card}
                        onClick={jest.fn()}
                        visiblePropertyTemplates={[]}
                        visibleTitle={true}
                        isSelected={true}
                        visibleBadges={false}
                        readonly={false}
                        isManualSort={true}
                        onDrop={jest.fn()}
                    />
                </ReduxProvider>,
            ))
            await act(async () => {
                const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
                userEvent.click(buttonElement)
            })
            expect(container).toMatchSnapshot()
        })
    })
    describe('with a comment content', () => {
        beforeEach(() => {
            card.fields.contentOrder = [contentComment.id]
            const state = {
                contents: {
                    contents: {
                        [contentComment.id]: contentComment,
                    },
                    contentsByCard: {
                        [card.id]: [contentComment],
                    },
                },
                cards: {
                    cards: {
                        [card.id]: card,
                    },
                },
                comments: {
                    comments: {},
                    commentsByCard: {},
                },
                teams: {
                    current: {id: 'team-id'},
                },
                boards: {
                    current: board.id,
                    boards: {
                        [board.id]: board,
                    },
                    templates: [],
                    myBoardMemberships: {
                        [board.id]: {userId: 'user_id_1', schemeAdmin: true},
                    },
                },
                users: {
                    me: {
                        id: 'user_id_1',
                        props: {},
                    },
                },
            }
            store = mockStateStore([], state)
        })
        test('should match snapshot', () => {
            const {container} = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <GalleryCard
                        board={board}
                        card={card}
                        onClick={jest.fn()}
                        visiblePropertyTemplates={[]}
                        visibleTitle={true}
                        isSelected={true}
                        visibleBadges={false}
                        readonly={false}
                        isManualSort={true}
                        onDrop={jest.fn()}
                    />
                </ReduxProvider>,
            ))
            const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
            userEvent.click(buttonElement)
            expect(container).toMatchSnapshot()
        })
        test('return GalleryCard with content readonly', () => {
            const {container} = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <GalleryCard
                        board={board}
                        card={card}
                        onClick={jest.fn()}
                        visiblePropertyTemplates={[]}
                        visibleTitle={true}
                        isSelected={true}
                        visibleBadges={false}
                        readonly={true}
                        isManualSort={true}
                        onDrop={jest.fn()}
                    />
                </ReduxProvider>,
            ))
            expect(container).toMatchSnapshot()
        })
    })
    describe('with many contents', () => {
        const contentDivider = TestBlockFactory.createDivider(card)
        contentDivider.id = 'contentId-Text2'
        beforeEach(() => {
            card.fields.contentOrder = [contentComment.id, contentDivider.id]
            const state = {
                contents: {
                    contents: {
                        [contentComment.id]: [contentComment, contentDivider],
                    },
                    contentsByCard: {
                        [card.id]: [contentComment, contentDivider],
                    },
                },
                cards: {
                    cards: {
                        [card.id]: card,
                    },
                },
                comments: {
                    comments: {},
                    commentsByCard: {},
                },
                teams: {
                    current: {id: 'team-id'},
                },
                boards: {
                    current: board.id,
                    boards: {
                        [board.id]: board,
                    },
                    templates: [],
                    myBoardMemberships: {
                        [board.id]: {userId: 'user_id_1', schemeAdmin: true},
                    },
                },
                users: {
                    me: {
                        id: 'user_id_1',
                        props: {},
                    },
                },
            }
            store = mockStateStore([], state)
        })
        test('should match snapshot', () => {
            const {container} = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <GalleryCard
                        board={board}
                        card={card}
                        onClick={jest.fn()}
                        visiblePropertyTemplates={[]}
                        visibleTitle={true}
                        isSelected={true}
                        visibleBadges={false}
                        readonly={false}
                        isManualSort={true}
                        onDrop={jest.fn()}
                    />
                </ReduxProvider>,
            ))
            const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
            userEvent.click(buttonElement)
            expect(container).toMatchSnapshot()
        })
        test('return GalleryCard with contents readonly', () => {
            const {container} = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <GalleryCard
                        board={board}
                        card={card}
                        onClick={jest.fn()}
                        visiblePropertyTemplates={[]}
                        visibleTitle={true}
                        isSelected={true}
                        visibleBadges={false}
                        readonly={true}
                        isManualSort={true}
                        onDrop={jest.fn()}
                    />
                </ReduxProvider>,
            ))
            expect(container).toMatchSnapshot()
        })
    })
})
