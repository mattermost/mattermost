// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties';

import {renderWithContext} from 'tests/react_testing_utils';

import ProfilePopoverPhone from './profile_popover_phone';

import {TestHelper} from '../../utils/test_helper';

describe('components/ProfilePopoverPhone', () => {
    const attribute: UserPropertyField = {
        id: 'phone_attribute_id',
        name: 'Phone Number',
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
                phone_attribute_id: '+1 (555) 123-4567',
            },
        }),
    };

    test('should not render when phone is missing', () => {
        const props = {
            ...baseProps,
            userProfile: TestHelper.getUserMock({
                id: 'user_id',
                custom_profile_attributes: {},
            }),
        };
        renderWithContext(<ProfilePopoverPhone {...props}/>);
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    test('should not render when phone is empty', () => {
        const props = {
            ...baseProps,
            userProfile: TestHelper.getUserMock({
                id: 'user_id',
                custom_profile_attributes: {
                    phone_attribute_id: '',
                },
            }),
        };
        renderWithContext(<ProfilePopoverPhone {...props}/>);
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    test('should render phone with icon', () => {
        renderWithContext(<ProfilePopoverPhone {...baseProps}/>);

        const phone = '+1 (555) 123-4567';
        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', 'tel:+1 (555) 123-4567');
        expect(link).toHaveTextContent(phone);
        expect(screen.getByTitle(phone)).toBeInTheDocument();
        expect(screen.getByLabelText('phone icon')).toBeInTheDocument();
    });

    test('should handle international phone numbers', () => {
        const props = {
            ...baseProps,
            userProfile: TestHelper.getUserMock({
                id: 'user_id',
                custom_profile_attributes: {
                    phone_attribute_id: '+44 20 7123 4567',
                },
            }),
        };
        renderWithContext(<ProfilePopoverPhone {...props}/>);

        const phone = '+44 20 7123 4567';
        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', 'tel:+44 20 7123 4567');
        expect(link).toHaveTextContent(phone);
    });
});
