// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {render} from '@testing-library/react'

import {wrapIntl} from 'src/testUtils'

import DividerElement from './dividerElement'

describe('components/content/DividerElement', () => {
    test('should match snapshot', async () => {
        const component = wrapIntl(<DividerElement/>)
        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })
})
