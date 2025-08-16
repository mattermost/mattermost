// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {PropertyFieldOption, UserPropertyField, UserPropertyFieldType} from '@mattermost/types/properties';

import {renderWithContext} from 'tests/react_testing_utils';

import ProfilePopoverSelectAttribute from './profile_popover_select_attribute';

import {TestHelper} from '../../utils/test_helper';

describe('components/ProfilePopoverSelectAttribute', () => {
    const options: PropertyFieldOption[] = [
        {id: 'option1', name: 'Option 1', color: '#FF0000'},
        {id: 'option2', name: 'Option 2', color: '#00FF00'},
        {id: 'option3', name: 'Option 3', color: '#0000FF'},
    ];

    const attribute: UserPropertyField = {
        id: 'select_attribute_id',
        name: 'Select Attribute',
        type: 'select' as UserPropertyFieldType,
        group_id: 'custom_profile_attributes',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        attrs: {
            options,
            visibility: 'when_set',
            sort_order: 0,
            value_type: '',
        },
    };

    const baseProps = {
        attribute,
        userProfile: TestHelper.getUserMock({
            id: 'user_id',
            custom_profile_attributes: {
                select_attribute_id: 'option1',
            },
        }),
    };

    test('should render select option name', () => {
        renderWithContext(<ProfilePopoverSelectAttribute {...baseProps}/>);

        const textElement = screen.getByText('Option 1');
        expect(textElement).toBeInTheDocument();
        expect(textElement).toHaveClass('user-popover__subtitle-text');
        expect(textElement).toHaveAttribute('aria-labelledby', 'user-popover__custom_attributes-title-select_attribute_id');
    });

    test('should render multiple selected options for multiselect', () => {
        const props = {
            ...baseProps,
            attribute: {
                ...attribute,
                type: 'multiselect' as UserPropertyFieldType,
            },
            userProfile: TestHelper.getUserMock({
                id: 'user_id',
                custom_profile_attributes: {
                    select_attribute_id: ['option1', 'option2'],
                },
            }),
        };
        renderWithContext(<ProfilePopoverSelectAttribute {...props}/>);

        const textElement = screen.getByText('Option 1, Option 2');
        expect(textElement).toBeInTheDocument();
    });

    test('should not render when attribute value is missing', () => {
        const props = {
            ...baseProps,
            userProfile: TestHelper.getUserMock({
                id: 'user_id',
                custom_profile_attributes: {},
            }),
        };
        const {container} = renderWithContext(<ProfilePopoverSelectAttribute {...props}/>);
        expect(container.firstChild).toBeNull();
    });

    test('should not render when options are missing', () => {
        const props = {
            ...baseProps,
            attribute: {
                ...attribute,
                attrs: {
                    ...attribute.attrs,
                    options: [],
                },
            },
        };
        const {container} = renderWithContext(<ProfilePopoverSelectAttribute {...props}/>);
        expect(container.firstChild).toBeNull();
    });

    test('should not render when option is not found', () => {
        const props = {
            ...baseProps,
            userProfile: TestHelper.getUserMock({
                id: 'user_id',
                custom_profile_attributes: {
                    select_attribute_id: 'non_existent_option',
                },
            }),
        };
        const {container} = renderWithContext(<ProfilePopoverSelectAttribute {...props}/>);
        expect(container.firstChild).toBeNull();
    });
});
