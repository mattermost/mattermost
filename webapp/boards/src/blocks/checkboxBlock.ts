// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {ContentBlock} from './contentBlock'
import {Block, createBlock} from './block'

type CheckboxBlock = ContentBlock & {
    type: 'checkbox'
}

function createCheckboxBlock(block?: Block): CheckboxBlock {
    return {
        ...createBlock(block),
        type: 'checkbox',
    }
}

export {CheckboxBlock, createCheckboxBlock}
