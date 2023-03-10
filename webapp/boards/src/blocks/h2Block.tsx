// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {ContentBlock} from './contentBlock'
import {Block, createBlock} from './block'

type H2Block = ContentBlock & {
    type: 'h2'
}

function createH2Block(block?: Block): H2Block {
    return {
        ...createBlock(block),
        type: 'h2',
    }
}

export {H2Block, createH2Block}

