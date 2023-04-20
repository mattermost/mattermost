// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* eslint-disable react/require-optimization */
import {IntlShape} from 'react-intl'

import {BlockTypes} from 'src/blocks/block'
import {ContentBlock} from 'src/blocks/contentBlock'
import {Utils} from 'src/utils'

export type ContentHandler = {
    type: BlockTypes
    getDisplayText: (intl: IntlShape) => string
    getIcon: () => JSX.Element
    createBlock: (boardId: string, intl: IntlShape) => Promise<ContentBlock>
    createComponent: (block: ContentBlock, readonly: boolean, onAddElement?: () => void, onDeleteElement?: () => void) => JSX.Element
}

class ContentRegistry {
    private registry: Map<BlockTypes, ContentHandler> = new Map()

    get contentTypes(): BlockTypes[] {
        return [...this.registry.keys()]
    }

    registerContentType(entry: ContentHandler) {
        if (this.isContentType(entry.type)) {
            Utils.logError(`registerContentType, already registered type: ${entry.type}`)
            return
        }
        this.registry.set(entry.type, entry)
    }

    isContentType(type: BlockTypes): boolean {
        return this.registry.has(type)
    }

    getHandler(type: BlockTypes): ContentHandler | undefined {
        return this.registry.get(type)
    }
}

const contentRegistry = new ContentRegistry()

export {contentRegistry}
