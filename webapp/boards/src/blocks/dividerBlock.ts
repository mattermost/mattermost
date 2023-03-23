// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {Block, createBlock} from './block'
import {ContentBlock} from './contentBlock'

type DividerBlock = ContentBlock & {
    type: 'divider'
}

function createDividerBlock(block?: Block): DividerBlock {
    return {
        ...createBlock(block),
        type: 'divider',
    }
}

export {DividerBlock, createDividerBlock}
