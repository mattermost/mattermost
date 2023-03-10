// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {render, screen, fireEvent} from '@testing-library/react'

import ListItemBlock from '.'

describe('components/blocksEditor/blocks/list-item', () => {
    test('should match Display snapshot', async () => {
        const Component = ListItemBlock.Display
        const {container} = render(
            <Component
                onChange={jest.fn()}
                value='test-value'
                onCancel={jest.fn()}
                onSave={jest.fn()}
            />,
        )
        expect(container).toMatchSnapshot()
    })

    test('should match Input snapshot', async () => {
        const Component = ListItemBlock.Input
        const {container} = render(
            <Component
                onChange={jest.fn()}
                value='test-value'
                onCancel={jest.fn()}
                onSave={jest.fn()}
            />,
        )
        expect(container).toMatchSnapshot()
    })

    test('should emit onChange event', async () => {
        const onChange = jest.fn()
        const Component = ListItemBlock.Input
        render(
            <Component
                onChange={onChange}
                value='test-value'
                onCancel={jest.fn()}
                onSave={jest.fn()}
            />,
        )

        expect(onChange).not.toBeCalled()

        const input = screen.getByTestId('list-item')
        fireEvent.change(input, {target: {value: 'test-value-'}})
        expect(onChange).toBeCalled()
    })

    test('should not emit onCancel event when value is not empty and hit backspace', async () => {
        const onCancel = jest.fn()
        const Component = ListItemBlock.Input
        render(
            <Component
                onChange={jest.fn()}
                value='test-value'
                onCancel={onCancel}
                onSave={jest.fn()}
            />,
        )

        expect(onCancel).not.toBeCalled()
        const input = screen.getByTestId('list-item')
        fireEvent.keyDown(input, {key: 'Backspace'})
        expect(onCancel).not.toBeCalled()
    })

    test('should emit onCancel event when value is empty and hit backspace', async () => {
        const onCancel = jest.fn()
        const Component = ListItemBlock.Input
        render(
            <Component
                onChange={jest.fn()}
                value=''
                onCancel={onCancel}
                onSave={jest.fn()}
            />,
        )

        expect(onCancel).not.toBeCalled()

        const input = screen.getByTestId('list-item')
        fireEvent.keyDown(input, {key: 'Backspace'})
        expect(onCancel).toBeCalled()
    })

    test('should emit onSave event hit enter', async () => {
        const onSave = jest.fn()
        const Component = ListItemBlock.Input
        render(
            <Component
                onChange={jest.fn()}
                value='test-value'
                onCancel={jest.fn()}
                onSave={onSave}
            />,
        )

        expect(onSave).not.toBeCalled()
        const input = screen.getByTestId('list-item')
        fireEvent.keyDown(input, {key: 'Enter'})
        expect(onSave).toBeCalled()
    })
})
