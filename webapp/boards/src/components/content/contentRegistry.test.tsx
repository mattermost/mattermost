// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import 'src/components/content/textElement'
import 'src/components/content/imageElement'
import 'src/components/content/dividerElement'
import 'src/components/content/checkboxElement'

import {ContentBlockTypes} from 'src/blocks/block'

import {contentRegistry} from './contentRegistry'

const contentBlockTypes = ['text', 'image', 'divider', 'checkbox'] as ContentBlockTypes[]

describe('components/content/ContentRegistry', () => {
    test('have all contentTypes', () => {
        expect(contentRegistry.contentTypes).toEqual(contentBlockTypes)
    })
    test.each(contentBlockTypes)('have a contentType %s', (content) => {
        expect(contentRegistry.isContentType(content)).toBeTruthy()
    })
    test.each(contentBlockTypes)('get a contentHandler for %s', (content) => {
        expect(contentRegistry.getHandler(content)).toBeTruthy()
    })
})
