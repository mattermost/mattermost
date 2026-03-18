// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import type {UserPropertyField, UserPropertyValueType} from '@mattermost/types/properties';

import {renderWithContext} from 'tests/react_testing_utils';

import ProfilePopoverCustomAttributes from './profile_popover_custom_attributes';

import {TestHelper} from '../../utils/test_helper';

jest.mock('mattermost-redux/actions/users', () => ({
    getCustomProfileAttributeValues: jest.fn().mockReturnValue({type: 'GET_CUSTOM_PROFILE_ATTRIBUTE_VALUES'}),
}));

describe('components/ProfilePopoverCustomAttributes', () => {
    const mockStore = configureStore();

    const textAttribute: UserPropertyField = {
        id: 'text_attribute_id',
        name: 'Text Attribute',
        type: 'text',
        group_id: 'custom_profile_attributes',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        attrs: {
            value_type: '' as UserPropertyValueType,
            visibility: 'when_set',
            sort_order: 0,
        },
    };

    const phoneAttribute: UserPropertyField = {
        id: 'phone_attribute_id',
        name: 'Phone Number',
        type: 'text',
        group_id: 'custom_profile_attributes',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        attrs: {
            value_type: 'phone' as UserPropertyValueType,
            visibility: 'when_set',
            sort_order: 1,
        },
    };

    const urlAttribute: UserPropertyField = {
        id: 'url_attribute_id',
        name: 'Website',
        type: 'text',
        group_id: 'custom_profile_attributes',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        attrs: {
            value_type: 'url' as UserPropertyValueType,
            visibility: 'when_set',
            sort_order: 2,
        },
    };

    const selectAttribute: UserPropertyField = {
        id: 'select_attribute_id',
        name: 'Select Attribute',
        type: 'select',
        group_id: 'custom_profile_attributes',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        attrs: {
            options: [
                {id: 'option1', name: 'Option 1', color: '#FF0000'},
                {id: 'option2', name: 'Option 2', color: '#00FF00'},
            ],
            visibility: 'when_set',
            sort_order: 3,
            value_type: '',
        },
    };

    const userProfile = TestHelper.getUserMock({
        id: 'user_id',
        custom_profile_attributes: {
            text_attribute_id: 'text value',
            phone_attribute_id: '+1 (555) 123-4567',
            url_attribute_id: 'https://example.com',
            select_attribute_id: 'option1',
        },
    });

    const baseState = {
        entities: {
            general: {
                config: {},
                customProfileAttributes: {
                    text_attribute_id: textAttribute,
                    phone_attribute_id: phoneAttribute,
                    url_attribute_id: urlAttribute,
                    select_attribute_id: selectAttribute,
                },
                license: {
                    Cloud: 'false',
                },
            },
            users: {
                profiles: {
                    user_id: userProfile,
                },
            },
        },
    };

    const baseProps = {
        userID: 'user_id',
    };

    test('should render all attribute types', () => {
        const store = mockStore(baseState);

        renderWithContext(
            <Provider store={store}>
                <ProfilePopoverCustomAttributes {...baseProps}/>
            </Provider>,
        );

        // Check that all attribute titles are rendered
        expect(screen.getByText('Text Attribute')).toBeInTheDocument();
        expect(screen.getByText('Phone Number')).toBeInTheDocument();
        expect(screen.getByText('Website')).toBeInTheDocument();
        expect(screen.getByText('Select Attribute')).toBeInTheDocument();

        // Check that all attribute values are rendered
        expect(screen.getByText('text value')).toBeInTheDocument();
        expect(screen.getByText('+1 (555) 123-4567')).toBeInTheDocument();
        expect(screen.getByText('https://example.com')).toBeInTheDocument();

        // URL attribute should be rendered as a link
        const urlLink = screen.getByRole('link', {name: 'https://example.com'});
        expect(urlLink).toBeInTheDocument();
        expect(urlLink).toHaveAttribute('href', 'https://example.com');

        expect(screen.getByText('Option 1')).toBeInTheDocument();
    });

    test('should fetch custom profile attributes if not available', () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                users: {
                    profiles: {
                        user_id: TestHelper.getUserMock({
                            id: 'user_id',
                            custom_profile_attributes: undefined,
                        }),
                    },
                },
            },
        };

        const store = mockStore(state);
        const dispatchMock = jest.spyOn(store, 'dispatch');

        renderWithContext(
            <Provider store={store}>
                <ProfilePopoverCustomAttributes {...baseProps}/>
            </Provider>,
        );

        expect(dispatchMock).toHaveBeenCalledWith(expect.objectContaining({
            type: 'GET_CUSTOM_PROFILE_ATTRIBUTE_VALUES',
        }));
    });

    test('should respect visibility settings', () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                general: {
                    ...baseState.entities.general,
                    customProfileAttributes: {
                        ...baseState.entities.general.customProfileAttributes,
                        text_attribute_id: {
                            ...textAttribute,
                            attrs: {
                                visibility: 'hidden',
                            },
                        },
                    },
                },
            },
        };

        const store = mockStore(state);

        renderWithContext(
            <Provider store={store}>
                <ProfilePopoverCustomAttributes {...baseProps}/>
            </Provider>,
        );

        // The attribute with 'hidden' visibility should not be rendered
        expect(screen.queryByText('Text Attribute')).not.toBeInTheDocument();

        // Other attributes should still be rendered
        expect(screen.getByText('Phone Number')).toBeInTheDocument();
        expect(screen.getByText('Website')).toBeInTheDocument();
        expect(screen.getByText('Select Attribute')).toBeInTheDocument();
    });

    test('should respect when_set visibility with empty values', () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                users: {
                    profiles: {
                        user_id: TestHelper.getUserMock({
                            id: 'user_id',
                            custom_profile_attributes: {
                                ...userProfile.custom_profile_attributes,
                                text_attribute_id: '', // Empty value
                            },
                        }),
                    },
                },
                general: {
                    ...baseState.entities.general,
                    customProfileAttributes: {
                        ...baseState.entities.general.customProfileAttributes,
                        text_attribute_id: {
                            ...textAttribute,
                            attrs: {
                                visibility: 'when_set',
                            },
                        },
                    },
                },
            },
        };

        const store = mockStore(state);

        renderWithContext(
            <Provider store={store}>
                <ProfilePopoverCustomAttributes {...baseProps}/>
            </Provider>,
        );

        // The attribute with empty value and 'when_set' visibility should not be rendered
        expect(screen.queryByText('Text Attribute')).not.toBeInTheDocument();
    });
});
