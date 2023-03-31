// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react'

import {ContentBlock} from 'src/blocks/contentBlock'
import {Utils} from 'src/utils'

import {useCardDetailContext} from 'src/components/cardDetail/cardDetailContext'

import {contentRegistry} from './contentRegistry'

// Need to require here to prevent webpack from tree-shaking these away
// TODO: Update webpack to avoid this
import './textElement'
import './imageElement'
import './dividerElement'
import './checkboxElement'

type Props = {
    block: ContentBlock
    readonly: boolean
    cords: {x: number, y?: number, z?: number}
}

export default function ContentElement(props: Props): JSX.Element|null {
    const {block, readonly, cords} = props
    const cardDetail = useCardDetailContext()

    const handler = contentRegistry.getHandler(block.type)
    if (!handler) {
        Utils.logError(`ContentElement, unknown content type: ${block.type}`)
        return null
    }

    const addElement = useCallback(() => {
        const index = cords.x + 1
        cardDetail.addBlock(handler, index, true)
    }, [cardDetail, cords, handler])

    const deleteElement = useCallback(() => {
        const index = cords.x
        cardDetail.deleteBlock(block, index)
    }, [block, cords, cardDetail])

    return handler.createComponent(block, readonly, addElement, deleteElement)
}
