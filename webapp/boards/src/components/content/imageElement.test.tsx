// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {render} from '@testing-library/react'

import {act} from 'react-dom/test-utils'

import {mocked} from 'jest-mock'

import {ImageBlock} from 'src/blocks/imageBlock'

import {wrapIntl} from 'src/testUtils'

import octoClient from 'src/octoClient'

import ImageElement from './imageElement'

jest.mock('src/octoClient')
const mockedOcto = mocked(octoClient, true)
mockedOcto.getFileAsDataUrl.mockResolvedValue({url: 'test.jpg'})

describe('components/content/ImageElement', () => {
    const defaultBlock: ImageBlock = {
        id: 'test-id',
        boardId: '1',
        parentId: '',
        modifiedBy: 'test-user-id',
        schema: 0,
        type: 'image',
        title: 'test-title',
        fields: {
            fileId: 'test.jpg',
        },
        createdBy: 'test-user-id',
        createAt: 0,
        updateAt: 0,
        deleteAt: 0,
        limited: false,
    }

    test('should match snapshot', async () => {
        const component = wrapIntl(
            <ImageElement
                block={defaultBlock}
            />,
        )
        let imageContainer: Element | undefined
        await act(async () => {
            const {container} = render(component)
            imageContainer = container
        })
        expect(imageContainer).toMatchSnapshot()
    })

    test('archived file', async () => {
        mockedOcto.getFileAsDataUrl.mockResolvedValue({
            archived: true,
            name: 'Filename',
            extension: '.txt',
            size: 165002,
        })

        const component = wrapIntl(
            <ImageElement
                block={defaultBlock}
            />,
        )
        let imageContainer: Element | undefined
        await act(async () => {
            const {container} = render(component)
            imageContainer = container
        })
        expect(imageContainer).toMatchSnapshot()
    })
})
