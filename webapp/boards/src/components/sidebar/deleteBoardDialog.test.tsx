// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react'
import {IntlProvider} from 'react-intl'

import userEvent from '@testing-library/user-event'
import {act, render} from '@testing-library/react'

import DeleteBoardDialog from './deleteBoardDialog'

describe('components/sidebar/DeleteBoardDialog', () => {
    it('Cancel should not submit', async () => {
        const container = renderTest()

        const cancelButton = container.querySelector('.dialog .footer button:not(.danger)')
        expect(cancelButton).not.toBeFalsy()
        expect(cancelButton?.textContent).toBe('Cancel')
        await act(async () => userEvent.click(cancelButton as Element))

        expect(container).toMatchSnapshot()
    })

    it('Delete should submit', async () => {
        const container = renderTest()

        const deleteButton = container.querySelector('.dialog .footer button.danger')
        expect(deleteButton).not.toBeFalsy()
        expect(deleteButton?.textContent).toBe('Delete')
        await act(async () => userEvent.click(deleteButton as Element))

        expect(container).toMatchSnapshot()
    })

    function renderTest() {
        const rootPortalDiv = document.createElement('div')
        rootPortalDiv.id = 'focalboard-root-portal'

        const {container} = render(<TestComponent/>, {container: document.body.appendChild(rootPortalDiv)})

        return container
    }

    function TestComponent() {
        const [isDeleted, setDeleted] = useState(false)
        const [isOpen, setOpen] = useState(true)

        return (<IntlProvider locale='en'>
            {isDeleted ? 'deleted' : 'exists'}
            {isOpen &&
            <DeleteBoardDialog
                boardTitle={'Delete'}
                onClose={() => setOpen(false)}
                onDelete={async () => setDeleted(true)}
            />}
        </IntlProvider>)
    }
})
