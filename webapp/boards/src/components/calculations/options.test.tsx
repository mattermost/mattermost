// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render} from '@testing-library/react'
import React from 'react'

import {IPropertyTemplate} from 'src/blocks/board'

import {wrapIntl} from 'src/testUtils'

import {CalculationOptions} from './options'

describe('components/calculations/Options', () => {
    test('should match snapshot', () => {
        const property = {
            type: 'number',
        } as IPropertyTemplate

        const component = wrapIntl(
            <CalculationOptions
                value={'none'}
                onChange={() => {}}
                property={property}
                menuOpen={false}
                options={[{
                    label: 'Count',
                    value: 'count',
                    displayName: 'Count',
                }]}
            />,
        )

        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot menu open', () => {
        const property = {
            type: 'number',
        } as IPropertyTemplate

        const component = wrapIntl(
            <CalculationOptions
                value={'none'}
                menuOpen={true}
                onChange={() => {}}
                property={property}
                options={[
                    {
                        label: 'Count',
                        value: 'count',
                        displayName: 'Count',
                    },
                    {
                        label: 'Max',
                        value: 'max',
                        displayName: 'Max',
                    },
                ]}
            />,
        )

        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })
})
