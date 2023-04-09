// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {render} from '@testing-library/react'

import userEvent from '@testing-library/user-event'

import {TestBlockFactory} from 'src/test/testBlockFactory'
import {wrapIntl} from 'src/testUtils'

import {TableCalculationOptions} from 'src/components/table/calculation/tableCalculationOptions'

import {ColumnResizeProvider} from 'src/components/table/tableColumnResizeContext'

import Calculation from './calculation'

describe('components/calculations/Calculation', () => {
    const board = TestBlockFactory.createBoard()

    const card = TestBlockFactory.createCard(board)
    card.fields.properties.property_2 = 'Foo'
    card.fields.properties.property_3 = 'Bar'
    card.fields.properties.property_4 = 'Baz'

    const card2 = TestBlockFactory.createCard(board)
    card2.fields.properties.property_2 = 'Lorem'
    card2.fields.properties.property_3 = ''
    card2.fields.properties.property_4 = 'Baz'

    const Wrapper: React.FC = ({children}) => {
        return wrapIntl(
            <ColumnResizeProvider
                columnWidths={{}}
                onResizeColumn={jest.fn()}
            >
                {children}
            </ColumnResizeProvider>,
        )
    }

    test('should match snapshot - none', () => {
        const {container} = render(
            <Wrapper>
                <Calculation
                    class={'fooClass'}
                    value={'none'}
                    menuOpen={false}
                    onMenuClose={() => {}}
                    onMenuOpen={() => {}}
                    onChange={() => {}}
                    cards={[card, card2]}
                    hovered={true}
                    property={{
                        id: 'property_2',
                        name: '',
                        type: 'text',
                        options: [],
                    }}
                    optionsComponent={TableCalculationOptions}
                />
            </Wrapper>,
        )

        expect(container).toMatchSnapshot()
    })

    test('should match snapshot - count', () => {
        const {container} = render(
            <Wrapper>
                <Calculation
                    class={'fooClass'}
                    value={'count'}
                    menuOpen={false}
                    onMenuClose={() => {}}
                    onMenuOpen={() => {}}
                    onChange={() => {}}
                    cards={[card, card2]}
                    hovered={true}
                    property={{
                        id: 'property_2',
                        name: '',
                        type: 'text',
                        options: [],
                    }}
                    optionsComponent={TableCalculationOptions}
                />
            </Wrapper>,
        )

        expect(container).toMatchSnapshot()
    })

    test('should match snapshot - countValue', () => {
        const {container} = render(
            <Wrapper>
                <Calculation
                    class={'fooClass'}
                    value={'countValue'}
                    menuOpen={false}
                    onMenuClose={() => {}}
                    onMenuOpen={() => {}}
                    onChange={() => {}}
                    cards={[card, card2]}
                    hovered={true}
                    property={{
                        id: 'property_3',
                        name: '',
                        type: 'text',
                        options: [],
                    }}
                    optionsComponent={TableCalculationOptions}
                />
            </Wrapper>,
        )

        expect(container).toMatchSnapshot()
    })

    test('should match snapshot - countUniqueValue', () => {
        const {container} = render(
            <Wrapper>
                <Calculation
                    class={'fooClass'}
                    value={'countUniqueValue'}
                    menuOpen={false}
                    onMenuClose={() => {}}
                    onMenuOpen={() => {}}
                    onChange={() => {}}
                    cards={[card, card2]}
                    hovered={true}
                    property={{
                        id: 'property_4',
                        name: '',
                        type: 'text',
                        options: [],
                    }}
                    optionsComponent={TableCalculationOptions}
                />
            </Wrapper>,
        )

        expect(container).toMatchSnapshot()
    })

    test('should match snapshot - option change', async () => {
        const onMenuOpen = jest.fn()
        const onMenuClose = jest.fn()
        const onChange = jest.fn()

        const {container} = render(
            <Wrapper>
                <Calculation
                    class={'fooClass'}
                    value={'none'}
                    menuOpen={true}
                    onMenuClose={onMenuClose}
                    onMenuOpen={onMenuOpen}
                    onChange={onChange}
                    cards={[card, card2]}
                    hovered={true}
                    property={{
                        id: 'property_2',
                        name: '',
                        type: 'text',
                        options: [],
                    }}
                    optionsComponent={TableCalculationOptions}
                />
            </Wrapper>,
        )

        const countMenuOption = container.querySelector('#react-select-2-option-1')
        await userEvent.click(countMenuOption as Element)
        expect(container).toMatchSnapshot()
        expect(onMenuOpen).not.toBeCalled()
        expect(onMenuClose).toBeCalled()
        expect(onChange).toBeCalled()
    })
})
