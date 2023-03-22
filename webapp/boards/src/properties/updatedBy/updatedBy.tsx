// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import {Block} from 'src/blocks/block'
import {useAppSelector} from 'src/store/hooks'
import {getLastCardContent} from 'src/store/contents'
import {getLastCardComment} from 'src/store/comments'
import Person from 'src/properties/person/person'

import {PropertyProps} from 'src/properties/types'

const LastModifiedBy = (props: PropertyProps): JSX.Element => {
    const lastContent = useAppSelector(getLastCardContent(props.card.id || '')) as Block
    const lastComment = useAppSelector(getLastCardComment(props.card.id)) as Block

    let latestBlock: Block = props.card
    if (props.board) {
        const allBlocks: Block[] = [props.card, lastContent, lastComment]
        const sortedBlocks = allBlocks.sort((a, b) => b.updateAt - a.updateAt)

        latestBlock = sortedBlocks.length > 0 ? sortedBlocks[0] : latestBlock
    }

    return (
        <Person
            {...props}
            propertyValue={latestBlock.modifiedBy}
            readOnly={true} // created by is an immutable property, so will always be readonly
        />
    )
}

export default LastModifiedBy
