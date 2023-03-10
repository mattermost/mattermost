// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useCallback} from 'react'

import {BlockIcons} from 'src/blockIcons'
import {Board} from 'src/blocks/board'

import mutator from 'src/mutator'

import IconSelector from './iconSelector'

type Props = {
    board: Board
    size?: 's' | 'm' | 'l'
    readonly?: boolean
}

const BoardIconSelector = React.memo((props: Props) => {
    const {board, size} = props

    const onSelectEmoji = useCallback((emoji: string) => {
        mutator.changeBoardIcon(board.id, board.icon, emoji)
        document.body.click()
    }, [board.id, board.icon])
    const onAddRandomIcon = useCallback(() => mutator.changeBoardIcon(board.id, board.icon, BlockIcons.shared.randomIcon()), [board.id, board.icon])
    const onRemoveIcon = useCallback(() => mutator.changeBoardIcon(board.id, board.icon, '', 'remove board icon'), [board.id, board.icon])

    if (!board.icon) {
        return null
    }

    let className = `octo-icon size-${size || 'm'}`
    if (props.readonly) {
        className += ' readonly'
    }
    const iconElement = <div className={className}><span>{board.icon}</span></div>

    return (
        <IconSelector
            readonly={props.readonly}
            iconElement={iconElement}
            onAddRandomIcon={onAddRandomIcon}
            onSelectEmoji={onSelectEmoji}
            onRemoveIcon={onRemoveIcon}
        />
    )
})

BoardIconSelector.displayName = 'BoardIconSelector'

export default BoardIconSelector
