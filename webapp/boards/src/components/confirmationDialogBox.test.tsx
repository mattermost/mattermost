// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import '@testing-library/jest-dom'
import {act, render} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import {wrapDNDIntl} from 'src/testUtils'

import ConfirmationDialogBox from './confirmationDialogBox'

describe('/components/confirmationDialogBox', () => {
    const dialogPropsWithCnfrmBtnText = {
        heading: 'test-heading',
        subText: 'test-sub-text',
        confirmButtonText: 'test-btn-text',
        onConfirm: jest.fn(),
        onClose: jest.fn(),
    }

    const dialogProps = {
        heading: 'test-heading',
        onConfirm: jest.fn(),
        onClose: jest.fn(),
    }

    it('confirmDialog should match snapshot', async () => {
        let container

        await act(async () => {
            const result = render(
                wrapDNDIntl(
                    <ConfirmationDialogBox
                        dialogBox={dialogPropsWithCnfrmBtnText}
                    />,
                ),
            )
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })

    it('confirmDialog with Confirm Button Text should match snapshot', async () => {
        let containerWithCnfrmBtnText
        await act(async () => {
            const result = render(
                wrapDNDIntl(
                    <ConfirmationDialogBox
                        dialogBox={dialogPropsWithCnfrmBtnText}
                    />,
                ),
            )
            containerWithCnfrmBtnText = result.container
        })
        expect(containerWithCnfrmBtnText).toMatchSnapshot()
    })

    it('confirm button click, run onConfirm Function once', () => {
        const result = render(
            wrapDNDIntl(<ConfirmationDialogBox dialogBox={dialogProps}/>),
        )

        userEvent.click(result.getByTitle('Confirm'))
        expect(dialogProps.onConfirm).toBeCalledTimes(1)
    })

    it('confirm button (with passed prop text), run onConfirm Function once', () => {
        const resultWithConfirmBtnText = render(
            wrapDNDIntl(
                <ConfirmationDialogBox
                    dialogBox={dialogPropsWithCnfrmBtnText}
                />,
            ),
        )

        userEvent.click(
            resultWithConfirmBtnText.getByTitle(dialogPropsWithCnfrmBtnText.confirmButtonText),
        )

        expect(dialogPropsWithCnfrmBtnText.onConfirm).toBeCalledTimes(1)
    })

    it('cancel button click runs onClose function', () => {
        const result = render(wrapDNDIntl(
            <ConfirmationDialogBox
                dialogBox={dialogProps}
            />,
        ))

        userEvent.click(result.getByTitle('Cancel'))
        expect(dialogProps.onClose).toBeCalledTimes(1)
    })
})
