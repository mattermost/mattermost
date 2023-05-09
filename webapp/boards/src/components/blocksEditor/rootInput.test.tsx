// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {fireEvent, render, screen} from '@testing-library/react'

import RootInput from './rootInput'

describe('components/blocksEditor/rootInput', () => {
    test('should match Display snapshot', async () => {
        const {container} = render(
            <RootInput
                onChange={jest.fn()}
                value='test-value'
                onChangeType={jest.fn()}
                onSave={jest.fn()}
            />,
        )
        expect(container).toMatchSnapshot()
    })

    test('should match Input snapshot', async () => {
        const {container} = render(
            <RootInput
                onChange={jest.fn()}
                value='test-value'
                onChangeType={jest.fn()}
                onSave={jest.fn()}
            />,
        )
        expect(container).toMatchSnapshot()
    })

    test('should match Input snapshot with menu open', async () => {
        const {container} = render(
            <RootInput
                onChange={jest.fn()}
                value=''
                onChangeType={jest.fn()}
                onSave={jest.fn()}
            />,
        )
        const input = screen.getByDisplayValue('')
        fireEvent.change(input, {target: {value: '/'}})
        expect(container).toMatchSnapshot()
    })

    test('should emit onChange event', async () => {
        const onChange = jest.fn()
        render(
            <RootInput
                onChange={onChange}
                value='test-value'
                onChangeType={jest.fn()}
                onSave={jest.fn()}
            />,
        )

        expect(onChange).not.toBeCalled()

        const input = screen.getByDisplayValue('test-value')
        fireEvent.change(input, {target: {value: 'test-value-'}})
        expect(onChange).toBeCalled()
    })

    test('should not emit onChangeType event when value is not empty and hit backspace', async () => {
        const onChangeType = jest.fn()
        render(
            <RootInput
                onChange={jest.fn()}
                value='test-value'
                onChangeType={onChangeType}
                onSave={jest.fn()}
            />,
        )

        expect(onChangeType).not.toBeCalled()
        const input = screen.getByDisplayValue('test-value')
        fireEvent.keyDown(input, {key: 'Backspace'})
        expect(onChangeType).not.toBeCalled()
    })

    test('should emit onSave event hit enter', async () => {
        const onSave = jest.fn()
        render(
            <RootInput
                onChange={jest.fn()}
                value='test-value'
                onChangeType={jest.fn()}
                onSave={onSave}
            />,
        )

        expect(onSave).not.toBeCalled()
        const input = screen.getByDisplayValue('test-value')
        fireEvent.keyDown(input, {key: 'Enter'})
        expect(onSave).toBeCalled()
    })

    test('should emit onChangeType event on menu option selected', async () => {
        const onChangeType = jest.fn()
        render(
            <RootInput
                onChange={jest.fn()}
                value=''
                onChangeType={onChangeType}
                onSave={jest.fn()}
            />,
        )

        const input = screen.getByDisplayValue('')
        fireEvent.change(input, {target: {value: '/'}})

        const option = screen.getByText('/title Creates a new Title block.')
        fireEvent.click(option)

        expect(onChangeType).toBeCalledWith(expect.objectContaining({name: 'h1'}))
    })
})
