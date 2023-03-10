// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {render, screen, fireEvent} from '@testing-library/react'
import {mocked} from 'jest-mock'

import octoClient from 'src/octoClient'

import ImageBlock from '.'

jest.mock('src/octoClient')

describe('components/blocksEditor/blocks/image', () => {
    test('should match Display snapshot', async () => {
        const mockedOcto = mocked(octoClient, true)
        mockedOcto.getFileAsDataUrl.mockResolvedValue({url: 'test.jpg'})
        const Component = ImageBlock.Display
        const {container} = render(
            <Component
                onChange={jest.fn()}
                value={{file: 'test'}}
                onCancel={jest.fn()}
                onSave={jest.fn()}
            />,
        )
        await screen.findByTestId('image')
        expect(container).toMatchSnapshot()
    })

    test('should match Display snapshot with empty value', async () => {
        const Component = ImageBlock.Display
        const {container} = render(
            <Component
                onChange={jest.fn()}
                value={{file: ''}}
                onCancel={jest.fn()}
                onSave={jest.fn()}
                currentBoardId=''
            />,
        )
        expect(container).toMatchSnapshot()
    })

    test('should match Input snapshot', async () => {
        const Component = ImageBlock.Input
        const {container} = render(
            <Component
                onChange={jest.fn()}
                value={{file: 'test'}}
                onCancel={jest.fn()}
                onSave={jest.fn()}
            />,
        )
        expect(container).toMatchSnapshot()
    })

    test('should match Input snapshot with empty input', async () => {
        const Component = ImageBlock.Input
        const {container} = render(
            <Component
                onChange={jest.fn()}
                value={{file: ''}}
                onCancel={jest.fn()}
                onSave={jest.fn()}
            />,
        )
        expect(container).toMatchSnapshot()
    })

    test('should emit onSave on change', async () => {
        const onSave = jest.fn()
        const Component = ImageBlock.Input
        render(
            <Component
                onChange={jest.fn()}
                value={{file: 'test'}}
                onCancel={jest.fn()}
                onSave={onSave}
            />,
        )

        expect(onSave).not.toBeCalled()
        const input = screen.getByTestId('image-input')
        fireEvent.change(input, {target: {files: ['test-file']}})
        expect(onSave).toBeCalledWith({file: 'test-file'})
    })
})
