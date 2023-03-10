// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useCallback} from 'react'

import {BlockIcons} from 'src/blockIcons'
import {Card} from 'src/blocks/card'
import mutator from 'src/mutator'

import IconSelector from './iconSelector'

type Props = {
    block: Card
    size?: 's' | 'm' | 'l'
    readonly?: boolean
}

const BlockIconSelector = (props: Props) => {
    const {block, size} = props

    const onSelectEmoji = useCallback((emoji: string) => {
        mutator.changeBlockIcon(block.boardId, block.id, block.fields.icon, emoji)
        document.body.click()
    }, [block.id, block.fields.icon])
    const onAddRandomIcon = useCallback(() => mutator.changeBlockIcon(block.boardId, block.id, block.fields.icon, BlockIcons.shared.randomIcon()), [block.id, block.fields.icon])
    const onRemoveIcon = useCallback(() => mutator.changeBlockIcon(block.boardId, block.id, block.fields.icon, '', 'remove icon'), [block.id, block.fields.icon])

    if (!block.fields.icon) {
        return null
    }

    let className = `octo-icon size-${size || 'm'}`
    if (props.readonly) {
        className += ' readonly'
    }
    const iconElement = <div className={className}><span>{block.fields.icon}</span></div>

    return (
        <IconSelector
            readonly={props.readonly}
            iconElement={iconElement}
            onAddRandomIcon={onAddRandomIcon}
            onSelectEmoji={onSelectEmoji}
            onRemoveIcon={onRemoveIcon}
        />
    )
}

export default React.memo(BlockIconSelector)
