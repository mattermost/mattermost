// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {render} from '@testing-library/react'

import 'isomorphic-fetch'
import {wrapDNDIntl} from 'src/testUtils'

import {TestBlockFactory} from 'src/test/testBlockFactory'

import {ColumnResizeProvider} from './tableColumnResizeContext'
import TableHeader from './tableHeader'

describe('components/table/TableHeaderMenu', () => {
    const board = TestBlockFactory.createBoard()
    const view = TestBlockFactory.createBoardView(board)

    const view2 = TestBlockFactory.createBoardView(board)
    view2.fields.sortOptions = []

    test('should match snapshot, title column', async () => {
        const onAutoSizeColumn = jest.fn()
        const component = wrapDNDIntl(
            <ColumnResizeProvider
                columnWidths={{}}
                onResizeColumn={jest.fn()}
            >
                <TableHeader
                    readonly={false}
                    sorted={'none'}
                    name={'my Name'}
                    board={board}
                    activeView={view}
                    cards={[]}
                    views={[view, view2]}
                    template={board.cardProperties[0]}
                    onDrop={jest.fn()}
                    onAutoSizeColumn={onAutoSizeColumn}
                />
            </ColumnResizeProvider>,
        )

        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })
})
