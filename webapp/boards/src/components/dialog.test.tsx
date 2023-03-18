// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react'

import React from 'react'

import userEvent from '@testing-library/user-event'

import {wrapDNDIntl} from 'src/testUtils'

import Menu from 'src/widgets/menu'

import OptionsIcon from 'src/widgets/icons/options'

import Dialog from './dialog'

describe('components/dialog', () => {
    beforeEach(jest.clearAllMocks)
    test('should match snapshot', () => {
        const {container} = render(wrapDNDIntl(
            <Dialog
                onClose={jest.fn()}
            >
                <div id='test'/>
            </Dialog>,
        ))
        expect(container).toMatchSnapshot()
    })
    test('should return dialog and click onClose button', async () => {
        const onCloseMethod = jest.fn()
        render(wrapDNDIntl(
            <Dialog
                onClose={onCloseMethod}
            >
                <div id='test'/>
            </Dialog>,
        ))
        const buttonClose = screen.getByRole('button', {name: 'Close dialog'})
        await userEvent.click(buttonClose)
        expect(onCloseMethod).toBeCalledTimes(1)
    })
    test('should return dialog and click to close on wrapper', async () => {
        const onCloseMethod = jest.fn()
        const {container} = render(wrapDNDIntl(
            <Dialog
                onClose={onCloseMethod}
            >
                <Menu position='left'>
                    <Menu.Text
                        id='test'
                        icon={<OptionsIcon/>}
                        name='Test'
                        onClick={async () => {
                            jest.fn()
                        }}
                    />
                </Menu>
            </Dialog>,
        ))
        const buttonClose = container.querySelector('.wrapper')!
        await userEvent.click(buttonClose)
        expect(onCloseMethod).toBeCalledTimes(1)
    })

    test('should return dialog and click on test button', async () => {
        const onTest = jest.fn()
        render(wrapDNDIntl(
            <Dialog
                onClose={jest.fn()}
                toolsMenu={<Menu position='left'>
                    <Menu.Text
                        id='test'
                        icon={<OptionsIcon/>}
                        name='Test'
                        onClick={async () => {
                            onTest()
                        }}
                    />
                </Menu>}
            >
                <div id='test'/>
            </Dialog>,
        ))
        const buttonMenu = screen.getByRole('button', {name: 'menuwrapper'})
        await userEvent.click(buttonMenu)
        const buttonTest = screen.getByRole('button', {name: 'Test'})
        await userEvent.click(buttonTest)
        expect(onTest).toBeCalledTimes(1)
    })
    test('should return dialog and click on cancel button', async () => {
        const {container} = render(wrapDNDIntl(
            <Dialog
                onClose={jest.fn()}
                toolsMenu={<Menu position='left'>
                    <Menu.Text
                        id='test'
                        icon={<OptionsIcon/>}
                        name='Test'
                        onClick={async () => {
                            jest.fn()
                        }}
                    />
                </Menu>}
            >
                <div id='test'/>
            </Dialog>,
        ))
        const buttonMenu = screen.getByRole('button', {name: 'menuwrapper'})
        await userEvent.click(buttonMenu)
        const buttonTest = screen.getByRole('button', {name: 'Cancel'})
        await userEvent.click(buttonTest)
        expect(container).toMatchSnapshot()
    })
})
