// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render} from '@testing-library/react';
import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';

import PropertyTypeIcon from './type_icon';

describe('components/property_value_editor/PropertyTypeIcon', () => {
    test.each<PropertyField['type']>([
        'text',
        'date',
        'select',
        'multiselect',
        'user',
    ])('renders the expected wrapper class for %s', (type) => {
        const {container} = render(<PropertyTypeIcon type={type}/>);
        const wrapper = container.querySelector(`.property-type-icon--${type}`);
        expect(wrapper).not.toBeNull();
        expect(wrapper?.querySelector('svg')).not.toBeNull();
    });

    test('renders the text fallback for unknown types', () => {
        const {container} = render(<PropertyTypeIcon type={'mystery' as PropertyField['type']}/>);
        expect(container.querySelector('.property-type-icon--text')).not.toBeNull();
    });

    test('forwards size to the underlying svg', () => {
        const {container} = render(
            <PropertyTypeIcon
                type='text'
                size={20}
            />,
        );
        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('width', '20');
        expect(svg).toHaveAttribute('height', '20');
    });
});
