// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState, useCallback} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'

import {Board} from 'src/blocks/board'
import {BoardView} from 'src/blocks/boardView'
import {Card} from 'src/blocks/card'
import octoClient from 'src/octoClient'
import mutator from 'src/mutator'
import {getCard} from 'src/store/cards'
import {getCardComments} from 'src/store/comments'
import {getCardContents} from 'src/store/contents'
import {useAppDispatch, useAppSelector} from 'src/store/hooks'
import {getCardAttachments, updateAttachments, updateUploadPrecent} from 'src/store/attachments'
import TelemetryClient, {TelemetryActions, TelemetryCategory} from 'src/telemetry/telemetryClient'
import {Utils} from 'src/utils'
import CompassIcon from 'src/widgets/icons/compassIcon'
import Menu from 'src/widgets/menu'
import {sendFlashMessage} from 'src/components/flashMessages'

import ConfirmationDialogBox, {ConfirmationDialogBoxProps} from 'src/components/confirmationDialogBox'

import Button from 'src/widgets/buttons/button'

import {getUserBlockSubscriptionList} from 'src/store/initialLoad'
import {getClientConfig} from 'src/store/clientConfig'

import {IUser} from 'src/user'
import {getMe} from 'src/store/users'
import {Permission} from 'src/constants'
import {Block, createBlock} from 'src/blocks/block'
import {AttachmentBlock, createAttachmentBlock} from 'src/blocks/attachmentBlock'

import BoardPermissionGate from './permissions/boardPermissionGate'

import CardDetail from './cardDetail/cardDetail'
import Dialog from './dialog'

import './cardDialog.scss'
import CardActionsMenu from './cardActionsMenu/cardActionsMenu'

type Props = {
    board: Board
    activeView: BoardView
    views: BoardView[]
    cards: Card[]
    cardId: string
    onClose: () => void
    showCard: (cardId?: string) => void
    readonly: boolean
}

const CardDialog = (props: Props): JSX.Element => {
    const {board, activeView, cards, views} = props
    const card = useAppSelector(getCard(props.cardId))
    const contents = useAppSelector(getCardContents(props.cardId))
    const comments = useAppSelector(getCardComments(props.cardId))
    const attachments = useAppSelector(getCardAttachments(props.cardId))
    const clientConfig = useAppSelector(getClientConfig)
    const intl = useIntl()
    const dispatch = useAppDispatch()
    const me = useAppSelector<IUser|null>(getMe)
    const isTemplate = card && card.fields.isTemplate

    const [showConfirmationDialogBox, setShowConfirmationDialogBox] = useState<boolean>(false)
    const makeTemplateClicked = async () => {
        if (!card) {
            Utils.assertFailure('card')
            return
        }

        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.AddTemplateFromCard, {board: props.board.id, view: activeView.id, card: props.cardId})
        await mutator.duplicateCard(
            props.cardId,
            board.id,
            card.fields.isTemplate,
            intl.formatMessage({id: 'Mutator.new-template-from-card', defaultMessage: 'new template from card'}),
            true,
            {},
            async (newCardId) => {
                props.showCard(newCardId)
            },
            async () => {
                props.showCard(undefined)
            },
        )
    }
    const handleDeleteCard = async () => {
        if (!card) {
            Utils.assertFailure()
            return
        }
        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.DeleteCard, {board: props.board.id, view: props.activeView.id, card: card.id})
        await mutator.deleteBlock(card, 'delete card')
        props.onClose()
    }

    const confirmDialogProps: ConfirmationDialogBoxProps = {
        heading: intl.formatMessage({id: 'CardDialog.delete-confirmation-dialog-heading', defaultMessage: 'Confirm card delete!'}),
        confirmButtonText: intl.formatMessage({id: 'CardDialog.delete-confirmation-dialog-button-text', defaultMessage: 'Delete'}),
        onConfirm: handleDeleteCard,
        onClose: () => {
            setShowConfirmationDialogBox(false)
        },
    }

    const handleDeleteButtonOnClick = () => {
        // use may be renaming a card title
        // and accidently delete the card
        // so adding des
        if (card?.title === '' && card?.fields.contentOrder.length === 0) {
            handleDeleteCard()
            return
        }

        setShowConfirmationDialogBox(true)
    }

    const menu = (
        <CardActionsMenu
            cardId={props.cardId}
            boardId={board.id}
            onClickDelete={handleDeleteButtonOnClick}
        >
            {!isTemplate &&
            <BoardPermissionGate permissions={[Permission.ManageBoardProperties]}>
                <Menu.Text
                    id='makeTemplate'
                    icon={
                        <CompassIcon
                            icon='plus'
                        />}
                    name='New template from card'
                    onClick={makeTemplateClicked}
                />
            </BoardPermissionGate>
            }
        </CardActionsMenu>
    )

    const removeUploadingAttachment = (uploadingBlock: Block) => {
        uploadingBlock.deleteAt = 1
        const removeUploadingAttachmentBlock = createAttachmentBlock(uploadingBlock)
        dispatch(updateAttachments([removeUploadingAttachmentBlock]))
    }

    const selectAttachment = (boardId: string) => {
        return new Promise<AttachmentBlock>(
            (resolve) => {
                Utils.selectLocalFile(async (attachment) => {
                    const uploadingBlock = createBlock()
                    uploadingBlock.title = attachment.name
                    uploadingBlock.fields.attachmentId = attachment.name
                    uploadingBlock.boardId = boardId
                    if (card) {
                        uploadingBlock.parentId = card.id
                    }
                    const attachmentBlock = createAttachmentBlock(uploadingBlock)
                    attachmentBlock.isUploading = true
                    dispatch(updateAttachments([attachmentBlock]))
                    if (attachment.size > clientConfig.maxFileSize) {
                        removeUploadingAttachment(uploadingBlock)
                        sendFlashMessage({content: intl.formatMessage({id: 'AttachmentBlock.failed', defaultMessage: 'Unable to upload the file. Attachment size limit reached.'}), severity: 'normal'})
                    } else {
                        sendFlashMessage({content: intl.formatMessage({id: 'AttachmentBlock.upload', defaultMessage: 'Attachment uploading.'}), severity: 'normal'})
                        const xhr = await octoClient.uploadAttachment(boardId, attachment)
                        if (xhr) {
                            xhr.upload.onprogress = (event) => {
                                const percent = Math.floor((event.loaded / event.total) * 100)
                                dispatch(updateUploadPrecent({
                                    blockId: attachmentBlock.id,
                                    uploadPercent: percent,
                                }))
                            }

                            xhr.onload = () => {
                                if (xhr.status === 200 && xhr.readyState === 4) {
                                    const json = JSON.parse(xhr.response)
                                    const attachmentId = json.fileId
                                    if (attachmentId) {
                                        removeUploadingAttachment(uploadingBlock)
                                        const block = createAttachmentBlock()
                                        block.fields.attachmentId = attachmentId || ''
                                        block.title = attachment.name
                                        sendFlashMessage({content: intl.formatMessage({id: 'AttachmentBlock.uploadSuccess', defaultMessage: 'Attachment uploaded successfull.'}), severity: 'normal'})
                                        resolve(block)
                                    } else {
                                        removeUploadingAttachment(uploadingBlock)
                                        sendFlashMessage({content: intl.formatMessage({id: 'AttachmentBlock.failed', defaultMessage: 'Unable to upload the file. Attachment size limit reached.'}), severity: 'normal'})
                                    }
                                }
                            }
                        }
                    }
                },
                '')
            },
        )
    }

    const addElement = async () => {
        if (!card) {
            return
        }
        const block = await selectAttachment(board.id)
        block.parentId = card.id
        block.boardId = card.boardId
        const typeName = block.type
        const description = intl.formatMessage({id: 'AttachmentBlock.addElement', defaultMessage: 'add {type}'}, {type: typeName})
        await mutator.insertBlock(block.boardId, block, description)
    }

    const deleteBlock = useCallback(async (block: Block) => {
        if (!card) {
            return
        }
        const description = intl.formatMessage({id: 'AttachmentBlock.DeleteAction', defaultMessage: 'delete'})
        await mutator.deleteBlock(block, description)
        sendFlashMessage({content: intl.formatMessage({id: 'AttachmentBlock.delete', defaultMessage: 'Attachment Deleted Successfully.'}), severity: 'normal'})
    }, [card?.boardId, card?.id, card?.fields.contentOrder])

    const attachBtn = (): React.ReactNode => {
        return (
            <BoardPermissionGate permissions={[Permission.ManageBoardCards]}>
                <Button
                    icon={<CompassIcon icon='paperclip'/>}
                    className='cardFollowBtn cardFollowBtn--attach'
                    emphasis='gray'
                    size='medium'
                    onClick={addElement}
                >
                    {intl.formatMessage({id: 'CardDetail.Attach', defaultMessage: 'Attach'})}
                </Button>
            </BoardPermissionGate>
        )
    }

    const followActionButton = (following: boolean): React.ReactNode => {
        const followBtn = (
            <>
                <Button
                    className='cardFollowBtn follow'
                    emphasis='gray'
                    size='medium'
                    onClick={() => mutator.followBlock(props.cardId, 'card', me!.id)}
                >
                    {intl.formatMessage({id: 'CardDetail.Follow', defaultMessage: 'Follow'})}
                </Button>
            </>
        )

        const unfollowBtn = (
            <>
                <Button
                    className='cardFollowBtn unfollow'
                    emphasis='tertiary'
                    size='medium'
                    onClick={() => mutator.unfollowBlock(props.cardId, 'card', me!.id)}
                >
                    {intl.formatMessage({id: 'CardDetail.Following', defaultMessage: 'Following'})}
                </Button>
            </>
        )

        if (!isTemplate && !card?.limited) {
            return (<>{attachBtn()}{following ? unfollowBtn : followBtn}</>)
        }
        return (<>{attachBtn()}</>)
    }

    const followingCards = useAppSelector(getUserBlockSubscriptionList)
    const isFollowingCard = Boolean(followingCards.find((following) => following.blockId === props.cardId))
    const toolbar = followActionButton(isFollowingCard)

    return (
        <>
            <Dialog
                title={<div/>}
                className='cardDialog'
                onClose={props.onClose}
                toolsMenu={!props.readonly && !card?.limited && menu}
                toolbar={toolbar}
            >
                {isTemplate &&
                    <div className='banner'>
                        <FormattedMessage
                            id='CardDialog.editing-template'
                            defaultMessage="You're editing a template."
                        />
                    </div>}

                {card &&
                    <CardDetail
                        board={board}
                        activeView={activeView}
                        views={views}
                        cards={cards}
                        card={card}
                        contents={contents}
                        comments={comments}
                        attachments={attachments}
                        readonly={props.readonly}
                        onClose={props.onClose}
                        onDelete={deleteBlock}
                        addAttachment={addElement}
                    />}

                {!card &&
                    <div className='banner error'>
                        <FormattedMessage
                            id='CardDialog.nocard'
                            defaultMessage="This card doesn't exist or is inaccessible."
                        />
                    </div>}
            </Dialog>

            {showConfirmationDialogBox && <ConfirmationDialogBox dialogBox={confirmDialogProps}/>}
        </>
    )
}

export default CardDialog
