// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {
    Fragment,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import {FormattedMessage, IntlShape, useIntl} from 'react-intl'

import {BlockIcons} from 'src/blockIcons'
import {Card} from 'src/blocks/card'
import {BoardView} from 'src/blocks/boardView'
import {Board} from 'src/blocks/board'
import {CommentBlock} from 'src/blocks/commentBlock'
import {AttachmentBlock} from 'src/blocks/attachmentBlock'
import {ContentBlock} from 'src/blocks/contentBlock'
import {Block, ContentBlockTypes, createBlock} from 'src/blocks/block'
import mutator from 'src/mutator'
import octoClient from 'src/octoClient'
import {Utils} from 'src/utils'
import Button from 'src/widgets/buttons/button'
import {Focusable} from 'src/widgets/editable'
import EditableArea from 'src/widgets/editableArea'
import CompassIcon from 'src/widgets/icons/compassIcon'
import TelemetryClient, {TelemetryActions, TelemetryCategory} from 'src/telemetry/telemetryClient'

import BlockIconSelector from 'src/components/blockIconSelector'

import {useAppDispatch, useAppSelector} from 'src/store/hooks'
import {setCurrent as setCurrentCard, updateCards} from 'src/store/cards'
import {updateContents} from 'src/store/contents'
import {Permission} from 'src/constants'
import {useHasCurrentBoardPermissions} from 'src/hooks/permissions'
import BlocksEditor from 'src/components/blocksEditor/blocksEditor'
import {BlockData} from 'src/components/blocksEditor/blocks/types'
import {ClientConfig} from 'src/config/clientConfig'
import {getClientConfig} from 'src/store/clientConfig'

import CardSkeleton from 'src/svg/card-skeleton'

import CommentsList from './commentsList'
import {CardDetailProvider} from './cardDetailContext'
import CardDetailContents from './cardDetailContents'
import CardDetailContentsMenu from './cardDetailContentsMenu'
import CardDetailProperties from './cardDetailProperties'
import useImagePaste from './imagePaste'
import AttachmentList from './attachment'

import './cardDetail.scss'

export const OnboardingBoardTitle = 'Welcome to Boards!'
export const OnboardingCardTitle = 'Create a new card'

type Props = {
    board: Board
    activeView: BoardView
    views: BoardView[]
    cards: Card[]
    card: Card
    comments: CommentBlock[]
    attachments: AttachmentBlock[]
    contents: Array<ContentBlock|ContentBlock[]>
    readonly: boolean
    onClose: () => void
    onDelete: (block: Block) => void
    addAttachment: () => void
}

async function addBlockNewEditor(card: Card, intl: IntlShape, title: string, fields: any, contentType: ContentBlockTypes, afterBlockId: string, dispatch: any): Promise<Block> {
    const block = createBlock()
    block.parentId = card.id
    block.boardId = card.boardId
    block.title = title
    block.type = contentType
    block.fields = {...block.fields, ...fields}

    const description = intl.formatMessage({id: 'CardDetail.addCardText', defaultMessage: 'add card text'})

    const afterRedo = async (newBlock: Block) => {
        const contentOrder = card.fields.contentOrder.slice()
        if (afterBlockId) {
            const idx = contentOrder.indexOf(afterBlockId)
            if (idx === -1) {
                contentOrder.push(newBlock.id)
            } else {
                contentOrder.splice(idx + 1, 0, newBlock.id)
            }
        } else {
            contentOrder.push(newBlock.id)
        }
        await octoClient.patchBlock(card.boardId, card.id, {updatedFields: {contentOrder}})
        dispatch(updateCards([{...card, fields: {...card.fields, contentOrder}}]))
    }

    const beforeUndo = async () => {
        const contentOrder = card.fields.contentOrder.slice()
        await octoClient.patchBlock(card.boardId, card.id, {updatedFields: {contentOrder}})
    }

    const newBlock = await mutator.insertBlock(block.boardId, block, description, afterRedo, beforeUndo)
    dispatch(updateContents([newBlock]))

    return newBlock
}

const CardDetail = (props: Props): JSX.Element|null => {
    const {card, comments, attachments, onDelete, addAttachment} = props
    const {limited} = card
    const [title, setTitle] = useState(card.title)
    const [serverTitle, setServerTitle] = useState(card.title)
    const titleRef = useRef<Focusable>(null)
    const saveTitle = useCallback(() => {
        if (title !== card.title) {
            mutator.changeBlockTitle(props.board.id, card.id, card.title, title)
        }
    }, [card.title, title])
    const canEditBoardCards = useHasCurrentBoardPermissions([Permission.ManageBoardCards])
    const canCommentBoardCards = useHasCurrentBoardPermissions([Permission.CommentBoardCards])

    const saveTitleRef = useRef<() => void>(saveTitle)
    saveTitleRef.current = saveTitle
    const intl = useIntl()

    const clientConfig = useAppSelector<ClientConfig>(getClientConfig)
    const newBoardsEditor = clientConfig?.featureFlags?.newBoardsEditor || false

    useImagePaste(props.board.id, card.id, card.fields.contentOrder)

    useEffect(() => {
        if (!title) {
            setTimeout(() => titleRef.current?.focus(), 300)
        }
        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.ViewCard, {board: props.board.id, view: props.activeView.id, card: card.id})
    }, [])

    useEffect(() => {
        if (serverTitle === title) {
            setTitle(card.title)
        }
        setServerTitle(card.title)
    }, [card.title, title])

    useEffect(() => {
        return () => {
            saveTitleRef.current?.()
        }
    }, [])

    const setRandomIcon = useCallback(() => {
        const newIcon = BlockIcons.shared.randomIcon()
        mutator.changeBlockIcon(props.board.id, card.id, card.fields.icon, newIcon)
    }, [card.id, card.fields.icon])

    const dispatch = useAppDispatch()
    useEffect(() => {
        dispatch(setCurrentCard(card.id))
    }, [card.id])

    if (!card) {
        return null
    }

    const blocks = useMemo(() => props.contents.flatMap((value: Block | Block[]): BlockData<any> => {
        const v: Block = Array.isArray(value) ? value[0] : value

        let data: any = v?.title
        if (v?.type === 'image') {
            data = {
                file: v?.fields.fileId,
            }
        }

        if (v?.type === 'attachment') {
            data = {
                file: v?.fields.fileId,
                filename: v?.fields.filename,
            }
        }

        if (v?.type === 'video') {
            data = {
                file: v?.fields.fileId,
                filename: v?.fields.filename,
            }
        }

        if (v?.type === 'checkbox') {
            data = {
                value: v?.title,
                checked: v?.fields.value,
            }
        }

        return {
            id: v?.id,
            value: data,
            contentType: v?.type,
        }
    }), [props.contents])

    return (
        <>
            <div className={`CardDetail ${limited ? ' CardDetail--is-limited' : ''}`}>
                <BlockIconSelector
                    block={card}
                    size='l'
                    readonly={props.readonly || !canEditBoardCards || limited}
                />
                {!props.readonly && canEditBoardCards && !card.fields.icon &&
                    <div className='add-buttons'>
                        <Button
                            emphasis='default'
                            size='small'
                            onClick={setRandomIcon}
                            icon={
                                <CompassIcon
                                    icon='emoticon-outline'
                                />}

                        >
                            <FormattedMessage
                                id='CardDetail.add-icon'
                                defaultMessage='Add icon'
                            />
                        </Button>
                    </div>}

                <EditableArea
                    ref={titleRef}
                    className='title'
                    value={title}
                    placeholderText='Untitled'
                    onChange={(newTitle: string) => setTitle(newTitle)}
                    saveOnEsc={true}
                    onSave={saveTitle}
                    onCancel={() => setTitle(props.card.title)}
                    readonly={props.readonly || !canEditBoardCards || limited}
                    spellCheck={true}
                />

                {/* Hidden (limited) card copy + CTA */}

                {limited && <div className='CardDetail__limited-wrapper'>
                    <CardSkeleton
                        className='CardDetail__limited-bg'
                    />
                    <p className='CardDetail__limited-title'>
                        <FormattedMessage
                            id='CardDetail.limited-title'
                            defaultMessage='This card is hidden'
                        />
                    </p>
                    <p className='CardDetail__limited-body'>
                        <FormattedMessage
                            id='CardDetail.limited-body'
                            defaultMessage='Upgrade to our Professional or Enterprise plan.'
                        />
                        <br/>
                        <a
                            className='CardDetail__limited-link'
                            role='button'
                            onClick={() => {
                                props.onClose();
                                (window as any).openPricingModal()({trackingLocation: 'boards > learn_more_about_our_plans_click'})
                            }}
                        >
                            <FormattedMessage
                                id='CardDetial.limited-link'
                                defaultMessage='Learn more about our plans.'
                            />
                        </a>
                    </p>
                    <Button
                        className='CardDetail__limited-button'
                        onClick={() => {
                            props.onClose();
                            (window as any).openPricingModal()({trackingLocation: 'boards > upgrade_click'})
                        }}
                        emphasis='primary'
                        size='large'
                    >
                        {intl.formatMessage({id: 'CardDetail.limited-button', defaultMessage: 'Upgrade'})}
                    </Button>
                </div>}

                {/* Property list */}

                {!limited &&
                <CardDetailProperties
                    board={props.board}
                    card={props.card}
                    cards={props.cards}
                    activeView={props.activeView}
                    views={props.views}
                    readonly={props.readonly}
                />}

                {attachments.length !== 0 && <Fragment>
                    <hr/>
                    <AttachmentList
                        attachments={attachments}
                        onDelete={onDelete}
                        addAttachment={addAttachment}
                    />
                </Fragment>}

                {/* Comments */}

                {!limited && <Fragment>
                    <hr/>
                    <CommentsList
                        comments={comments}
                        boardId={card.boardId}
                        cardId={card.id}
                        readonly={props.readonly || !canCommentBoardCards}
                    />
                </Fragment>}
            </div>

            {/* Content blocks */}

            {!limited && <div className='CardDetail CardDetail--fullwidth content-blocks'>
                {newBoardsEditor && (
                    <BlocksEditor
                        boardId={card.boardId}
                        blocks={blocks}
                        onBlockCreated={async (block: any, afterBlock: any): Promise<BlockData|null> => {
                            if (block.contentType === 'text' && block.value === '') {
                                return null
                            }
                            let newBlock: Block
                            if (block.contentType === 'checkbox') {
                                newBlock = await addBlockNewEditor(card, intl, block.value.value, {value: block.value.checked}, block.contentType, afterBlock?.id, dispatch)
                            } else if (block.contentType === 'image' || block.contentType === 'attachment' || block.contentType === 'video') {
                                const newFileId = await octoClient.uploadFile(card.boardId, block.value.file)
                                newBlock = await addBlockNewEditor(card, intl, '', {fileId: newFileId, filename: block.value.filename}, block.contentType, afterBlock?.id, dispatch)
                            } else {
                                newBlock = await addBlockNewEditor(card, intl, block.value, {}, block.contentType, afterBlock?.id, dispatch)
                            }

                            return {...block, id: newBlock.id}
                        }}
                        onBlockModified={async (block: any): Promise<BlockData<any>|null> => {
                            const originalContentBlock = props.contents.flatMap((b) => b).find((b) => b.id === block.id)
                            if (!originalContentBlock) {
                                return null
                            }

                            if (block.contentType === 'text' && block.value === '') {
                                const description = intl.formatMessage({id: 'ContentBlock.DeleteAction', defaultMessage: 'delete'})

                                mutator.deleteBlock(originalContentBlock, description)

                                return null
                            }
                            const newBlock = {
                                ...originalContentBlock,
                                title: block.value,
                            }

                            if (block.contentType === 'checkbox') {
                                newBlock.title = block.value.value
                                newBlock.fields = {...newBlock.fields, value: block.value.checked}
                            }
                            mutator.updateBlock(card.boardId, newBlock, originalContentBlock, intl.formatMessage({id: 'ContentBlock.editCardText', defaultMessage: 'edit card text'}))

                            return block
                        }}
                        onBlockMoved={async (block: BlockData, beforeBlock: BlockData|null, afterBlock: BlockData|null): Promise<void> => {
                            if (block.id) {
                                const idx = card.fields.contentOrder.indexOf(block.id)
                                let sourceBlockId: string
                                let sourceWhere: 'after'|'before'
                                if (idx === -1) {
                                    Utils.logError('Unable to find the block id in the order of the current block')

                                    return
                                }
                                if (idx === 0) {
                                    sourceBlockId = card.fields.contentOrder[1] as string
                                    sourceWhere = 'before'
                                } else {
                                    sourceBlockId = card.fields.contentOrder[idx - 1] as string
                                    sourceWhere = 'after'
                                }
                                if (afterBlock && afterBlock.id) {
                                    await mutator.moveContentBlock(block.id, afterBlock.id, 'after', sourceBlockId, sourceWhere, intl.formatMessage({id: 'ContentBlock.moveBlock', defaultMessage: 'move card content'}))

                                    return
                                }
                                if (beforeBlock && beforeBlock.id) {
                                    await mutator.moveContentBlock(block.id, beforeBlock.id, 'before', sourceBlockId, sourceWhere, intl.formatMessage({id: 'ContentBlock.moveBlock', defaultMessage: 'move card content'}))
                                }
                            }
                        }}
                    />)}
                {!newBoardsEditor && (
                    <CardDetailProvider card={card}>
                        <CardDetailContents
                            card={props.card}
                            contents={props.contents}
                            readonly={props.readonly || !canEditBoardCards}
                        />
                        {!props.readonly && canEditBoardCards && <CardDetailContentsMenu/>}
                    </CardDetailProvider>)}
            </div>}
        </>
    )
}

export default CardDetail
