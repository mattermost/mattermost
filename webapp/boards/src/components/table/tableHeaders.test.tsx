// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {render} from '@testing-library/react'
import '@testing-library/jest-dom'

import 'isomorphic-fetch'
import {wrapDNDIntl} from 'src/testUtils'

import {TestBlockFactory} from 'src/test/testBlockFactory'

import {ColumnResizeProvider} from './tableColumnResizeContext'
import TableHeaders from './tableHeaders'

describe('components/table/TableHeaders', () => {
    const board = TestBlockFactory.createBoard()
    const card = TestBlockFactory.createCard(board)
    const view = TestBlockFactory.createBoardView(board)

    test('should match snapshot', async () => {
        const component = wrapDNDIntl(
            <ColumnResizeProvider
                columnWidths={{}}
                onResizeColumn={() => {}}
            >
                <TableHeaders
                    board={board}
                    cards={[card]}
                    activeView={view}
                    views={[view]}
                    readonly={false}
                />
            </ColumnResizeProvider>,
        )

        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })
})
