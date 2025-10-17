// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent} from '@testing-library/react';
import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties';

import {renderWithContext} from 'tests/react_testing_utils';

import ProfilePopoverPhone from './profile_popover_phone';

import {TestHelper} from '../../utils/test_helper';

// Mock window.open
const mockWindowOpen = jest.fn();
Object.defineProperty(window, 'open', {
    writable: true,
    value: mockWindowOpen,
});

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

    beforeEach(() => {
        mockWindowOpen.mockClear();
    });

    test('should not render when phone is missing', () => {
        const props = {
            ...baseProps,
            userProfile: TestHelper.getUserMock({
                id: 'user_id',
                custom_profile_attributes: {},
            }),
        };
        const {container} = renderWithContext(<ProfilePopoverPhone {...props}/>);
        expect(container.firstChild).toBeNull();
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
        const {container} = renderWithContext(<ProfilePopoverPhone {...props}/>);
        expect(container.firstChild).toBeNull();
    });

    test('should render phone with icon', () => {
        renderWithContext(<ProfilePopoverPhone {...baseProps}/>);

        const phone = '+1 (555) 123-4567';
        const phoneLink = screen.getByText(phone);
        expect(phoneLink).toBeInTheDocument();
        expect(phoneLink.tagName).toBe('A');
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
        const phoneLink = screen.getByText(phone);
        expect(phoneLink).toBeInTheDocument();
        expect(phoneLink.tagName).toBe('A');
    });

    test('should open phone dialer when clicked', () => {
        renderWithContext(<ProfilePopoverPhone {...baseProps}/>);

        const phone = '+1 (555) 123-4567';
        const phoneLink = screen.getByText(phone);

        fireEvent.click(phoneLink);

        expect(mockWindowOpen).toHaveBeenCalledWith('tel:+1 (555) 123-4567');
    });

    test('should prevent default click behavior', () => {
        renderWithContext(<ProfilePopoverPhone {...baseProps}/>);

        const phone = '+1 (555) 123-4567';
        const phoneLink = screen.getByText(phone);

        const clickEvent = fireEvent.click(phoneLink);

        expect(clickEvent).toBe(false); // fireEvent.click returns false when preventDefault was called
        expect(mockWindowOpen).toHaveBeenCalledWith('tel:+1 (555) 123-4567');
    });
});
