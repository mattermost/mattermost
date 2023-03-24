// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {Block, createBlock} from './block'
import {ContentBlock} from './contentBlock'

type ImageBlockFields = {
    fileId: string
}

type ImageBlock = ContentBlock & {
    type: 'image'
    fields: ImageBlockFields
}

function createImageBlock(block?: Block): ImageBlock {
    return {
        ...createBlock(block),
        type: 'image',
        fields: {
            fileId: block?.fields.fileId || '',
        },
    }
}

export {ImageBlock, createImageBlock}
