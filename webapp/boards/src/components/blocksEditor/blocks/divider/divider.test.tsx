// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {render} from '@testing-library/react'

import DividerBlock from '.'

describe('components/blocksEditor/blocks/divider', () => {
    test('should match Display snapshot', async () => {
        const Component = DividerBlock.Display
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
        const Component = DividerBlock.Input
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

    test('should emit onSave event on mount', async () => {
        const onSave = jest.fn()
        const Component = DividerBlock.Input
        render(
            <Component
                onChange={jest.fn()}
                value='test-value'
                onCancel={jest.fn()}
                onSave={onSave}
            />,
        )
        expect(onSave).toBeCalled()
    })
})
