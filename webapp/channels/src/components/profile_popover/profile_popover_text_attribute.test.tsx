// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties';

import {renderWithContext} from 'tests/react_testing_utils';

import ProfilePopoverTextAttribute from './profile_popover_text_attribute';

import {TestHelper} from '../../utils/test_helper';

describe('components/ProfilePopoverTextAttribute', () => {
    const attribute: UserPropertyField = {
        id: 'text_attribute_id',
        name: 'Text Attribute',
        type: 'text',
        group_id: 'custom_profile_attributes',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        attrs: {
            value_type: 'phone',
            visibility: 'when_set',
            sort_order: 0,
        },
    };

    const baseProps = {
        attribute,
        userProfile: TestHelper.getUserMock({
            id: 'user_id',
            custom_profile_attributes: {
                text_attribute_id: 'text value',
            },
        }),
    };

    test('should render text attribute value', () => {
        renderWithContext(<ProfilePopoverTextAttribute {...baseProps}/>);

        const textElement = screen.getByText('text value');
        expect(textElement).toBeInTheDocument();
        expect(textElement).toHaveClass('user-popover__subtitle-text');
        expect(textElement).toHaveAttribute('aria-labelledby', 'user-popover__custom_attributes-title-text_attribute_id');
    });

    test('should not render when attribute value is missing', () => {
        const props = {
            ...baseProps,
            userProfile: TestHelper.getUserMock({
                id: 'user_id',
                custom_profile_attributes: {},
            }),
        };
        const {container} = renderWithContext(<ProfilePopoverTextAttribute {...props}/>);
        expect(container.firstChild).toBeNull();
    });

    test('should not render when attribute value is empty', () => {
        const props = {
            ...baseProps,
            userProfile: TestHelper.getUserMock({
                id: 'user_id',
                custom_profile_attributes: {
                    text_attribute_id: '',
                },
            }),
        };
        const {container} = renderWithContext(<ProfilePopoverTextAttribute {...props}/>);
        expect(container.firstChild).toBeNull();
    });
});
