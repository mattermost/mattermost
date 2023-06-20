// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import {render} from '@testing-library/react'

import {FileInfo} from 'src/blocks/block'

import ArchivedFile from './archivedFile'

describe('components/content/archivedFile', () => {
    it('should match snapshot', () => {
        const fileInfo: FileInfo = {
            archived: true,
            extension: '.txt',
            name: 'stuff to put in jell-o',
            size: 2056,
        }

        const component = (<ArchivedFile fileInfo={fileInfo}/>)
        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })
})
