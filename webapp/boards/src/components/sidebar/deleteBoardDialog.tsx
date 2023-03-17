// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState} from 'react'
import {FormattedMessage} from 'react-intl'

import {Utils} from 'src/utils'
import Button from 'src/widgets/buttons/button'

import Dialog from 'src/components/dialog'
import RootPortal from 'src/components/rootPortal'

import './deleteBoardDialog.scss'

type Props = {
    boardTitle: string
    onClose: () => void
    onDelete: () => Promise<void>
    isTemplate?: boolean
}

export default function DeleteBoardDialog(props: Props): JSX.Element {
    const [isSubmitting, setSubmitting] = useState(false)

    return (
        <RootPortal>
            <Dialog
                onClose={props.onClose}
                toolsMenu={null}
                className='DeleteBoardDialog'
            >
                <div className='container'>
                    <h2 className='header text-heading5'>
                        {props.isTemplate &&
                            <FormattedMessage
                                id='DeleteBoardDialog.confirm-tite-template'
                                defaultMessage='Confirm delete board template'
                            />}
                        {!props.isTemplate &&
                            <FormattedMessage
                                id='DeleteBoardDialog.confirm-tite'
                                defaultMessage='Confirm delete board'
                            />}
                    </h2>
                    <p className='body'>
                        {props.isTemplate &&
                            <FormattedMessage
                                id='DeleteBoardDialog.confirm-info-template'
                                defaultMessage='Are you sure you want to delete the board template “{boardTitle}”?'
                                values={{
                                    boardTitle: props.boardTitle,
                                }}
                            />}
                        {!props.isTemplate &&
                            <FormattedMessage
                                id='DeleteBoardDialog.confirm-info'
                                defaultMessage='Are you sure you want to delete the board “{boardTitle}”? Deleting it will delete all cards in the board.'
                                values={{
                                    boardTitle: props.boardTitle,
                                }}
                            />}
                    </p>
                    <div className='footer'>
                        <Button
                            size={'medium'}
                            emphasis={'tertiary'}
                            onClick={(e: React.MouseEvent) => {
                                e.stopPropagation()
                                !isSubmitting && props.onClose()
                            }}
                        >
                            <FormattedMessage
                                id='DeleteBoardDialog.confirm-cancel'
                                defaultMessage='Cancel'
                            />
                        </Button>
                        <Button
                            size={'medium'}
                            filled={true}
                            danger={true}
                            onClick={async (e: React.MouseEvent) => {
                                e.stopPropagation()
                                try {
                                    setSubmitting(true)
                                    await props.onDelete()
                                    setSubmitting(false)
                                    props.onClose()
                                } catch (err) {
                                    setSubmitting(false)
                                    Utils.logError(`Delete board ERROR: ${err}`)

                                    // TODO: display error on screen
                                }
                            }}
                        >
                            <FormattedMessage
                                id='DeleteBoardDialog.confirm-delete'
                                defaultMessage='Delete'
                            />
                        </Button>
                    </div>
                </div>
            </Dialog>
        </RootPortal>
    )
}
