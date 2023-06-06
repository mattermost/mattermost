// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import {render} from '@testing-library/react'
import {act} from 'react-dom/test-utils'
import {mocked} from 'jest-mock'

import {AttachmentBlock} from 'src/blocks/attachmentBlock'
import {mockStateStore, wrapIntl} from 'src/testUtils'
import octoClient from 'src/octoClient'
import {TestBlockFactory} from 'src/test/testBlockFactory'
import {IUser} from 'src/user'

import AttachmentElement from './attachmentElement'

jest.mock('src/octoClient')
const mockedOcto = mocked(octoClient)
mockedOcto.getFileAsDataUrl.mockResolvedValue({url: 'test.txt'})
mockedOcto.getFileInfo.mockResolvedValue({
    name: 'test.txt',
    size: 2300,
    extension: '.txt',
})

const board = TestBlockFactory.createBoard()
board.id = '1'
board.teamId = 'team-id'
board.channelId = 'channel_1'

describe('component/content/FileBlock', () => {
    const defaultBlock: AttachmentBlock = {
        id: 'test-id',
        boardId: '1',
        parentId: '',
        modifiedBy: 'test-user-id',
        schema: 0,
        type: 'attachment',
        title: 'test-title',
        fields: {
            fileId: 'test.txt',
        },
        createdBy: 'test-user-id',
        createAt: 0,
        updateAt: 0,
        deleteAt: 0,
        limited: false,
        isUploading: false,
        uploadingPercent: 0,
    }

    const me: IUser = {
        id: 'user-id-1',
        username: 'username_1',
        email: '',
        nickname: '',
        firstname: '',
        lastname: '',
        props: {},
        create_at: 0,
        update_at: 0,
        is_bot: false,
        is_guest: false,
        roles: 'system_user',
    }

    const state = {
        teams: {
            current: {id: 'team-id', title: 'Test Team'},
        },
        users: {
            me,
            boardUsers: [me],
            blockSubscriptions: [],
        },
        boards: {
            current: board.id,
            boards: {
                [board.id]: board,
            },
            templates: [],
            membersInBoards: {
                [board.id]: {},
            },
            myBoardMemberships: {
                [board.id]: {userId: me.id, schemeAdmin: true},
            },
        },

        attachments: {
            attachments: {
                'test-id': {
                    uploadPercent: 0,
                },
            },
        },
    }

    const store = mockStateStore([], state)

    test('should match snapshot', async () => {
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <AttachmentElement
                    block={defaultBlock}
                />
            </ReduxProvider>,
        )
        let fileContainer: Element | undefined
        await act(async () => {
            const {container} = render(component)
            fileContainer = container
        })
        expect(fileContainer).toMatchSnapshot()
    })

    test('archived file', async () => {
        mockedOcto.getFileAsDataUrl.mockResolvedValue({
            archived: true,
            name: 'FileName',
            extension: '.txt',
            size: 165002,
        })

        const component = wrapIntl(
            <ReduxProvider store={store}>
                <AttachmentElement
                    block={defaultBlock}
                />
            </ReduxProvider>,
        )
        let fileContainer: Element | undefined
        await act(async () => {
            const {container} = render(component)
            fileContainer = container
        })
        expect(fileContainer).toMatchSnapshot()
    })
})
