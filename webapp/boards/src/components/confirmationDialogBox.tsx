// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode, useCallback} from 'react'
import {FormattedMessage} from 'react-intl'

import Button from 'src/widgets/buttons/button'

import Dialog from './dialog'
import './confirmationDialogBox.scss'

type ConfirmationDialogBoxProps = {
    heading: string
    subText?: string | ReactNode
    confirmButtonText?: string
    destructive?: boolean
    onConfirm: () => void
    onClose: () => void
}

type Props = {
    dialogBox: ConfirmationDialogBoxProps
}

export const ConfirmationDialogBox = (props: Props) => {
    const handleOnClose = useCallback(props.dialogBox.onClose, [])
    const handleOnConfirm = useCallback(props.dialogBox.onConfirm, [])

    return (
        <Dialog
            size='small'
            className='confirmation-dialog-box'
            onClose={handleOnClose}
        >
            <div
                className='box-area'
                title='Confirmation Dialog Box'
            >
                <h3 className='text-heading5'>{props.dialogBox.heading}</h3>
                <div className='sub-text'>{props.dialogBox.subText}</div>

                <div className='action-buttons'>
                    <Button
                        title='Cancel'
                        size='medium'
                        emphasis='tertiary'
                        onClick={handleOnClose}
                    >
                        <FormattedMessage
                            id='ConfirmationDialog.cancel-action'
                            defaultMessage='Cancel'
                        />
                    </Button>
                    <Button
                        title={props.dialogBox.confirmButtonText || 'Confirm'}
                        size='medium'
                        submit={true}
                        danger={Boolean(props.dialogBox.destructive)}
                        onClick={handleOnConfirm}
                        filled={true}
                    >
                        { props.dialogBox.confirmButtonText ||
                        <FormattedMessage
                            id='ConfirmationDialog.confirm-action'
                            defaultMessage='Confirm'
                        />
                        }
                    </Button>
                </div>
            </div>
        </Dialog>
    )
}

export default ConfirmationDialogBox
export {ConfirmationDialogBoxProps}
