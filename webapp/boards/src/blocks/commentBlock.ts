// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {Block, createBlock} from './block'

type CommentBlock = Block & {
    type: 'comment'
}

function createCommentBlock(block?: Block): CommentBlock {
    return {
        ...createBlock(block),
        type: 'comment',
    }
}

export {CommentBlock, createCommentBlock}
