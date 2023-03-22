// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {render, screen, fireEvent} from '@testing-library/react'

import CheckboxBlock from '.'

describe('components/blocksEditor/blocks/checkbox', () => {
    test('should match Display snapshot', async () => {
        const Component = CheckboxBlock.Display
        const {container} = render(
            <Component
                onChange={jest.fn()}
                value={{value: 'test-value', checked: true}}
                onCancel={jest.fn()}
                onSave={jest.fn()}
            />,
        )
        expect(container).toMatchSnapshot()
    })

    test('should match Display snapshot not checked', async () => {
        const Component = CheckboxBlock.Display
        const {container} = render(
            <Component
                onChange={jest.fn()}
                value={{value: 'test-value', checked: false}}
                onCancel={jest.fn()}
                onSave={jest.fn()}
            />,
        )
        expect(container).toMatchSnapshot()
    })

    test('should match Input snapshot', async () => {
        const Component = CheckboxBlock.Input
        const {container} = render(
            <Component
                onChange={jest.fn()}
                value={{value: 'test-value', checked: true}}
                onCancel={jest.fn()}
                onSave={jest.fn()}
            />,
        )
        expect(container).toMatchSnapshot()
    })

    test('should match Input snapshot not checked', async () => {
        const Component = CheckboxBlock.Input
        const {container} = render(
            <Component
                onChange={jest.fn()}
                value={{value: 'test-value', checked: false}}
                onCancel={jest.fn()}
                onSave={jest.fn()}
            />,
        )
        expect(container).toMatchSnapshot()
    })

    test('should emit onSave event on Display checkbox clicked', async () => {
        const onSave = jest.fn()
        const Component = CheckboxBlock.Display
        render(
            <Component
                onChange={jest.fn()}
                value={{value: 'test-value', checked: true}}
                onCancel={jest.fn()}
                onSave={onSave}
            />,
        )
        expect(onSave).not.toBeCalled()

        const input = screen.getByTestId('checkbox-check')
        fireEvent.click(input)
        expect(onSave).toBeCalledWith({value: 'test-value', checked: false})
    })

    test('should emit onChange event on input change', async () => {
        const onChange = jest.fn()
        const Component = CheckboxBlock.Input
        render(
            <Component
                onChange={onChange}
                value={{value: 'test-value', checked: true}}
                onCancel={jest.fn()}
                onSave={jest.fn()}
            />,
        )

        expect(onChange).not.toBeCalled()

        const input = screen.getByTestId('checkbox-input')
        fireEvent.change(input, {target: {value: 'test-value-'}})
        expect(onChange).toBeCalledWith({value: 'test-value-', checked: true})
    })

    test('should emit onChange event on checkbox click', async () => {
        const onChange = jest.fn()
        const Component = CheckboxBlock.Input
        render(
            <Component
                onChange={onChange}
                value={{value: 'test-value', checked: true}}
                onCancel={jest.fn()}
                onSave={jest.fn()}
            />,
        )

        expect(onChange).not.toBeCalled()

        const input = screen.getByTestId('checkbox-check')
        fireEvent.click(input)
        expect(onChange).toBeCalledWith({value: 'test-value', checked: false})
    })

    test('should not emit onCancel event when value is not empty and hit backspace', async () => {
        const onCancel = jest.fn()
        const Component = CheckboxBlock.Input
        render(
            <Component
                onChange={jest.fn()}
                value={{value: 'test-value', checked: true}}
                onCancel={onCancel}
                onSave={jest.fn()}
            />,
        )

        expect(onCancel).not.toBeCalled()
        const input = screen.getByTestId('checkbox-input')
        fireEvent.keyDown(input, {key: 'Backspace'})
        expect(onCancel).not.toBeCalled()
    })

    test('should emit onCancel event when value is empty and hit backspace', async () => {
        const onCancel = jest.fn()
        const Component = CheckboxBlock.Input
        render(
            <Component
                onChange={jest.fn()}
                value={{value: '', checked: false}}
                onCancel={onCancel}
                onSave={jest.fn()}
            />,
        )

        expect(onCancel).not.toBeCalled()

        const input = screen.getByTestId('checkbox-input')
        fireEvent.keyDown(input, {key: 'Backspace'})
        expect(onCancel).toBeCalled()
    })

    test('should emit onSave event hit enter', async () => {
        const onSave = jest.fn()
        const Component = CheckboxBlock.Input
        render(
            <Component
                onChange={jest.fn()}
                value={{value: 'test-value', checked: true}}
                onCancel={jest.fn()}
                onSave={onSave}
            />,
        )

        expect(onSave).not.toBeCalled()
        const input = screen.getByTestId('checkbox-input')
        fireEvent.keyDown(input, {key: 'Enter'})
        expect(onSave).toBeCalledWith({value: 'test-value', checked: true})
    })
})
