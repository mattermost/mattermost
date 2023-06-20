// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {useIntl} from 'react-intl'

import {Block, BlockTypes} from 'src/blocks/block'
import {Card} from 'src/blocks/card'
import mutator from 'src/mutator'
import octoClient from 'src/octoClient'
import {Utils} from 'src/utils'
import Menu from 'src/widgets/menu'

import {contentRegistry} from './content/contentRegistry'

type Props = {
    type: BlockTypes
    card: Card
    cords: {x: number, y?: number, z?: number}
}

const AddContentMenuItem = (props: Props): JSX.Element => {
    const {card, type, cords} = props
    const index = cords.x
    const intl = useIntl()

    const handler = contentRegistry.getHandler(type)
    if (!handler) {
        Utils.logError(`addContentMenu, unknown content type: ${type}`)

        return <></>
    }

    return (
        <Menu.Text
            key={type}
            id={type}
            name={handler.getDisplayText(intl)}
            icon={handler.getIcon()}
            onClick={async () => {
                const newBlock = await handler.createBlock(card.boardId, intl)
                newBlock.parentId = card.id
                newBlock.boardId = card.boardId

                const typeName = handler.getDisplayText(intl)
                const description = intl.formatMessage({id: 'ContentBlock.addElement', defaultMessage: 'add {type}'}, {type: typeName})

                const afterRedo = async (nb: Block) => {
                    const contentOrder = card.fields.contentOrder.slice()
                    contentOrder.splice(index, 0, nb.id)
                    await octoClient.patchBlock(card.boardId, card.id, {updatedFields: {contentOrder}})
                }

                const beforeUndo = async () => {
                    const contentOrder = card.fields.contentOrder.slice()
                    await octoClient.patchBlock(card.boardId, card.id, {updatedFields: {contentOrder}})
                }

                await mutator.insertBlock(newBlock.boardId, newBlock, description, afterRedo, beforeUndo)
            }}
        />
    )
}

export default React.memo(AddContentMenuItem)
