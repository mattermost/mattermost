// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import {render, screen, act} from '@testing-library/react'

import userEvent from '@testing-library/user-event'

import {mockStateStore} from 'src/testUtils'
import {wrapIntl} from 'src/testUtils'

import CreateBoardFromTemplate from './createBoardFromTemplate'

jest.mock('src/hooks/useGetAllTemplates', () => ({
    useGetAllTemplates: () => [{id: 'id', title: 'title', description: 'description', icon: '🍔'}]
}))

describe('components/createBoardFromTemplate', () => {
    const state = {
        language: {
            value: 'en',
        },
    }

    it('renders the Create Boards from template component and match snapshot', async () => {
        const store = mockStateStore([], state)
        let container: Element | DocumentFragment | null = null
        const setCanCreate = jest.fn
        const setAction = jest.fn
        const newBoardInfoIcon = (<i className="icon-information-outline" />)

        await act(async () => {
            const result = render(wrapIntl(
                <ReduxProvider store={store}>
                    <CreateBoardFromTemplate
                        setAction={setAction}
                        setCanCreate={setCanCreate}
                        newBoardInfoIcon={newBoardInfoIcon}
                    />
                </ReduxProvider>
            ))
            container = result.container
        })

        expect(container).toMatchSnapshot()
    })

    it('clicking checkbox toggles the templates selector', async () => {
        const store = mockStateStore([], state)
        const setCanCreate = jest.fn
        const setAction = jest.fn
        const newBoardInfoIcon = (<i className="icon-information-outline" />)

        await act(async () => {
            render(wrapIntl(
                <ReduxProvider store={store}>
                    <CreateBoardFromTemplate
                        setAction={setAction}
                        setCanCreate={setCanCreate}
                        newBoardInfoIcon={newBoardInfoIcon}
                    />
                </ReduxProvider>
            ))
        })

        // click to show the template selector
        let checkbox = screen.getByRole('checkbox', {checked: false})
        await act(async () => {
            await userEvent.click(checkbox)
            const templatesSelector = screen.queryByText('Select a template')
            expect(templatesSelector).toBeTruthy()
        })

        // click to hide the template selector
        checkbox = screen.getByRole('checkbox', {checked: true})
        await act(async () => {
            await userEvent.click(checkbox)
            const templatesSelector = screen.queryByText('Select a template')
            expect(templatesSelector).toBeNull()
        })

    })
})
