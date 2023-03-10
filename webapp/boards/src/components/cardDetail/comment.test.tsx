// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import moment from 'moment'

import {mocked} from 'jest-mock'

import {wrapIntl, mockStateStore} from 'src/testUtils'

import {TestBlockFactory} from 'src/test/testBlockFactory'

import mutator from 'src/mutator'

import Comment from './comment'

jest.mock('src/mutator')
const mockedMutator = mocked(mutator, true)

const board = TestBlockFactory.createBoard()
const card = TestBlockFactory.createCard(board)
const comment = TestBlockFactory.createComment(card)
const dateFixed = Date.parse('01 Oct 2020')
comment.createAt = dateFixed
comment.updateAt = dateFixed
comment.title = 'Test comment'

const userImageUrl = 'data:image/svg+xml'

describe('components/cardDetail/comment', () => {
    const state = {
        users: {
            boardUsers: {[comment.modifiedBy]: {username: 'username_1'}},
        },
    }
    const store = mockStateStore([], state)

    beforeEach(() => {
        jest.clearAllMocks()
        moment.now = () => {
            return dateFixed + (24 * 60 * 60 * 1000)
        }
    })

    afterEach(() => {
        moment.now = () => {
            return Number(new Date())
        }
    })

    test('return comment', () => {
        const {container} = render(wrapIntl(
            <ReduxProvider store={store}>
                <Comment
                    comment={comment}
                    userId={comment.modifiedBy}
                    userImageUrl={userImageUrl}
                    readonly={false}
                />
            </ReduxProvider>,
        ))
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
    })

    test('return comment readonly', () => {
        const {container} = render(wrapIntl(
            <ReduxProvider store={store}>
                <Comment
                    comment={comment}
                    userId={comment.modifiedBy}
                    userImageUrl={userImageUrl}
                    readonly={true}
                />
            </ReduxProvider>,
        ))
        expect(container).toMatchSnapshot()
    })

    test('return comment and delete comment', () => {
        const {container} = render(wrapIntl(
            <ReduxProvider store={store}>
                <Comment
                    comment={comment}
                    userId={comment.modifiedBy}
                    userImageUrl={userImageUrl}
                    readonly={false}
                />
            </ReduxProvider>,
        ))
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const buttonDelete = screen.getByRole('button', {name: 'Delete'})
        userEvent.click(buttonDelete)
        expect(mockedMutator.deleteBlock).toBeCalledTimes(1)
        expect(mockedMutator.deleteBlock).toBeCalledWith(comment)
    })

    test('return guest comment', () => {
        const localStore = mockStateStore([], {users: {boardUsers: {[comment.modifiedBy]: {username: 'username_1', is_guest: true}}}})
        const {container} = render(wrapIntl(
            <ReduxProvider store={localStore}>
                <Comment
                    comment={comment}
                    userId={comment.modifiedBy}
                    userImageUrl={userImageUrl}
                    readonly={false}
                />
            </ReduxProvider>,
        ))
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
    })

    test('return guest comment readonly', () => {
        const localStore = mockStateStore([], {users: {boardUsers: {[comment.modifiedBy]: {username: 'username_1', is_guest: true}}}})
        const {container} = render(wrapIntl(
            <ReduxProvider store={localStore}>
                <Comment
                    comment={comment}
                    userId={comment.modifiedBy}
                    userImageUrl={userImageUrl}
                    readonly={true}
                />
            </ReduxProvider>,
        ))
        expect(container).toMatchSnapshot()
    })

    test('return guest comment and delete comment', () => {
        const localStore = mockStateStore([], {users: {boardUsers: {[comment.modifiedBy]: {username: 'username_1', is_guest: true}}}})
        const {container} = render(wrapIntl(
            <ReduxProvider store={localStore}>
                <Comment
                    comment={comment}
                    userId={comment.modifiedBy}
                    userImageUrl={userImageUrl}
                    readonly={false}
                />
            </ReduxProvider>,
        ))
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const buttonDelete = screen.getByRole('button', {name: 'Delete'})
        userEvent.click(buttonDelete)
        expect(mockedMutator.deleteBlock).toBeCalledTimes(1)
        expect(mockedMutator.deleteBlock).toBeCalledWith(comment)
    })
})
