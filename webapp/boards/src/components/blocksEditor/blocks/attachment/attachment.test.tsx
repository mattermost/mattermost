// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {render, screen, fireEvent} from '@testing-library/react'
import {mocked} from 'jest-mock'

import octoClient from 'src/octoClient'

import AttachmentBlock from '.'

jest.mock('src/octoClient')

describe('components/blocksEditor/blocks/attachment', () => {
    test('should match Display snapshot', async () => {
        const mockedOcto = mocked(octoClient, true)
        mockedOcto.getFileAsDataUrl.mockResolvedValue({url: 'test.jpg'})
        const Component = AttachmentBlock.Display
        const {container} = render(
            <Component
                onChange={jest.fn()}
                value={{file: 'test', filename: 'test-filename'}}
                onCancel={jest.fn()}
                onSave={jest.fn()}
            />,
        )
        await screen.findByTestId('attachment')
        expect(container).toMatchSnapshot()
    })

    test('should match Display snapshot with empty value', async () => {
        const Component = AttachmentBlock.Display
        const {container} = render(
            <Component
                onChange={jest.fn()}
                value={{file: '', filename: ''}}
                onCancel={jest.fn()}
                onSave={jest.fn()}
                currentBoardId=''
            />,
        )
        expect(container).toMatchSnapshot()
    })

    test('should match Input snapshot', async () => {
        const Component = AttachmentBlock.Input
        const {container} = render(
            <Component
                onChange={jest.fn()}
                value={{file: 'test', filename: 'test-filename'}}
                onCancel={jest.fn()}
                onSave={jest.fn()}
            />,
        )
        expect(container).toMatchSnapshot()
    })

    test('should match Input snapshot with empty input', async () => {
        const Component = AttachmentBlock.Input
        const {container} = render(
            <Component
                onChange={jest.fn()}
                value={{file: '', filename: ''}}
                onCancel={jest.fn()}
                onSave={jest.fn()}
            />,
        )
        expect(container).toMatchSnapshot()
    })

    test('should emit onSave on change', async () => {
        const onSave = jest.fn()
        const Component = AttachmentBlock.Input
        render(
            <Component
                onChange={jest.fn()}
                value={{file: 'test', filename: 'test-filename'}}
                onCancel={jest.fn()}
                onSave={onSave}
            />,
        )

        expect(onSave).not.toBeCalled()
        const input = screen.getByTestId('attachment-input')
        fireEvent.change(input, {target: {files: {length: 1, item: () => new File([], 'test-file', {type: 'text/plain'})}}})
        expect(onSave).toBeCalledWith({file: new File([], 'test-file', {type: 'text/plain'}), filename: 'test-file'})
    })
})
