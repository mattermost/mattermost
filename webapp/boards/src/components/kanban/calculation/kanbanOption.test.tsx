// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {render} from '@testing-library/react'

import {TestBlockFactory} from 'src/test/testBlockFactory'

import {Option} from './kanbanOption'

describe('components/kanban/calculations/Option', () => {
    const board = TestBlockFactory.createBoard()

    test('base case', () => {
        const component = (
            <Option
                data={{
                    label: 'Count Unique Values',
                    displayName: 'Unique',
                    value: 'countUniqueValue',
                    cardProperties: board.cardProperties,
                    onChange: () => {},
                    activeValue: 'count',
                    activeProperty: board.cardProperties[1],
                }}
            />
        )

        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })
})
