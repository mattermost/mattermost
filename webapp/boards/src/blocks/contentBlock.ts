// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {Block, createBlock} from './block'

type IContentBlockWithCords = {
    block: Block
    cords: {x: number, y?: number, z?: number}
}

type ContentBlock = Block

const createContentBlock = createBlock

export {ContentBlock, IContentBlockWithCords, createContentBlock}
