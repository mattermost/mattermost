// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {
    createContext,
    ReactElement,
    ReactNode,
    useContext,
    useMemo,
    useState,
    useCallback
} from 'react'

import {useIntl} from 'react-intl'

import {Block} from 'src/blocks/block'
import {Card} from 'src/blocks/card'
import {ContentHandler} from 'src/components/content/contentRegistry'
import octoClient from 'src/octoClient'
import mutator from 'src/mutator'

export type AddedBlock = {
    id: string
    autoAdded: boolean
}

export type CardDetailContextType = {
    card: Card
    lastAddedBlock: AddedBlock
    addBlock: (handler: ContentHandler, index: number, auto: boolean) => void
    deleteBlock: (block: Block, index: number) => void
}

export const CardDetailContext = createContext<CardDetailContextType | null>(null)

export function useCardDetailContext(): CardDetailContextType {
    const cardDetailContext = useContext(CardDetailContext)
    if (!cardDetailContext) {
        throw new Error('CardDetailContext is not available!')
    }
    return cardDetailContext
}

type CardDetailProps = {
    card: Card
    children: ReactNode
}

export const CardDetailProvider = (props: CardDetailProps): ReactElement => {
    const intl = useIntl()
    const [lastAddedBlock, setLastAddedBlock] = useState<AddedBlock>({
        id: '',
        autoAdded: false,
    })
    const {card} = props
    const addBlock = useCallback(async (handler: ContentHandler, index: number, auto: boolean) => {
        const block = await handler.createBlock(card.boardId, intl)
        block.parentId = card.id
        block.boardId = card.boardId
        const typeName = handler.getDisplayText(intl)
        const description = intl.formatMessage({id: 'ContentBlock.addElement', defaultMessage: 'add {type}'}, {type: typeName})
        await mutator.performAsUndoGroup(async () => {
            const afterRedo = async (newBlock: Block) => {
                const contentOrder = card.fields.contentOrder.slice()
                contentOrder.splice(index, 0, newBlock.id)
                await octoClient.patchBlock(card.boardId, card.id, {updatedFields: {contentOrder}})
            }

            const beforeUndo = async () => {
                const contentOrder = card.fields.contentOrder.slice()
                await octoClient.patchBlock(card.boardId, card.id, {updatedFields: {contentOrder}})
            }

            const insertedBlock = await mutator.insertBlock(block.boardId, block, description, afterRedo, beforeUndo)
            setLastAddedBlock({id: insertedBlock.id, autoAdded: auto})
        })
    }, [card.boardId, card.id, card.fields.contentOrder])

    const deleteBlock = useCallback(async (block: Block, index: number) => {
        const contentOrder = card.fields.contentOrder.slice()
        contentOrder.splice(index, 1)
        const description = intl.formatMessage({id: 'ContentBlock.DeleteAction', defaultMessage: 'delete'})
        await mutator.performAsUndoGroup(async () => {
            await mutator.deleteBlock(block, description)
            await mutator.changeCardContentOrder(card.boardId, card.id, card.fields.contentOrder, contentOrder, description)
        })
    }, [card.boardId, card.id, card.fields.contentOrder])

    const contextValue = useMemo(() => ({
        card,
        lastAddedBlock,
        addBlock,
        deleteBlock,
    }), [card, lastAddedBlock, addBlock, deleteBlock])

    return (
        <CardDetailContext.Provider value={contextValue}>
            {props.children}
        </CardDetailContext.Provider>
    )
}
