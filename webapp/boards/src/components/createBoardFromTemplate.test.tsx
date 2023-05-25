// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import {act, render, screen} from '@testing-library/react'

import userEvent from '@testing-library/user-event'

import {mockStateStore, wrapIntl} from 'src/testUtils'

import CreateBoardFromTemplate from './createBoardFromTemplate'

jest.mock('src/hooks/useGetAllTemplates', () => ({
    useGetAllTemplates: () => [{id: 'id', title: 'title', description: 'description', icon: '🍔'}],
}))

describe('components/createBoardFromTemplate', () => {
    const state = {
        language: {
            value: 'en',
        },
    }

    it('renders the Create Boards from template component and match snapshot', async () => {
        const store = mockStateStore([], state)
        const setCanCreate = jest.fn
        const setAction = jest.fn
        const newBoardInfoIcon = (<i className='icon-information-outline'/>)

        const {container} = render(wrapIntl(
            <ReduxProvider store={store}>
                <CreateBoardFromTemplate
                    setAction={setAction}
                    setCanCreate={setCanCreate}
                    newBoardInfoIcon={newBoardInfoIcon}
                />
            </ReduxProvider>
        ))

        expect(container).toMatchSnapshot()
    })

    it.only('clicking checkbox toggles the templates selector', async () => {
        const store = mockStateStore([], state)
        const setCanCreate = jest.fn
        const setAction = jest.fn
        const newBoardInfoIcon = (<i className='icon-information-outline'/>)

        render(wrapIntl(
            <ReduxProvider store={store}>
                <CreateBoardFromTemplate
                    setAction={setAction}
                    setCanCreate={setCanCreate}
                    newBoardInfoIcon={newBoardInfoIcon}
                />
            </ReduxProvider>
        ))

        // click to show the template selector
        await act(async () => {
            const checkbox = await screen.findByRole('checkbox', {checked: false})
            await userEvent.click(checkbox)
        })
        expect(screen.queryByText('Select a template')).toBeTruthy()

        // click to hide the template selector
        await act(async () => {
            const checkbox = await screen.findByRole('checkbox', {checked: true})
            await userEvent.click(checkbox)
        })
        expect(screen.queryByText('Select a template')).toBeNull()
    })
})
