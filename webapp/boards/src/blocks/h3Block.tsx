// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {ContentBlock} from './contentBlock'
import {Block, createBlock} from './block'

type H3Block = ContentBlock & {
    type: 'h3'
}

function createH3Block(block?: Block): H3Block {
    return {
        ...createBlock(block),
        type: 'h3',
    }
}

export {H3Block, createH3Block}

