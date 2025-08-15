// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MultiValueProps} from 'react-select/dist/declarations/src/components/MultiValue';

import type {UserProfile} from '@mattermost/types/users';

import {fireEvent, renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {AutocompleteOptionType} from './user_multiselector';
import {MultiUserProfilePill} from './user_profile_pill';

describe('components/admin_console/content_flagging/user_multiselector/UserProfilePill', () => {
    const baseProps = {
        data: {
            value: 'user-id-1',
            label: 'Test User',
            raw: TestHelper.getUserMock({
                id: 'user-id-1',
                username: 'testuser',
                first_name: 'Test',
                last_name: 'User',
                email: 'test@example.com',
            }),
        } as AutocompleteOptionType<UserProfile>,
        innerProps: {},
        selectProps: {},
        removeProps: {
            onClick: jest.fn(),
        },
        index: 0,
        isDisabled: false,
        isFocused: false,
        getValue: jest.fn(),
        hasValue: true,
        options: [],
        setValue: jest.fn(),
        clearValue: jest.fn(),
        cx: jest.fn(),
        getStyles: jest.fn(),
        getClassNames: jest.fn(),
        isMulti: true,
        isRtl: false,
        theme: {} as any,
    } as unknown as MultiValueProps<AutocompleteOptionType<UserProfile>, true>;

    const initialState = {
        entities: {
            users: {
                profiles: {
                    'user-id-1': baseProps.data.raw,
                },
            },
            preferences: {
                myPreferences: {},
            },
            general: {
                config: {
                    TeammateNameDisplay: 'full_name',
                },
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render user profile pill with avatar and display name', () => {
        const {container} = renderWithContext(
            <MultiUserProfilePill {...baseProps}/>,
            initialState,
        );

        expect(container).toMatchSnapshot();
    });

    test('should render with correct user display name', () => {
        const {container} = renderWithContext(
            <MultiUserProfilePill {...baseProps}/>,
            initialState,
        );

        const pill = container.querySelector('.UserProfilePill');
        expect(pill).toBeInTheDocument();
        expect(pill).toHaveTextContent('Test User');
    });

    test('should render Avatar component with correct props', () => {
        const {container} = renderWithContext(
            <MultiUserProfilePill {...baseProps}/>,
            initialState,
        );

        const avatar = container.querySelector('.Avatar');
        expect(avatar).toBeInTheDocument();
    });

    test('should render Remove component with close icon', () => {
        const {container} = renderWithContext(
            <MultiUserProfilePill {...baseProps}/>,
            initialState,
        );

        const removeComponent = container.querySelector('.Remove');
        expect(removeComponent).toBeInTheDocument();
    });

    test('should call onClick when remove button is clicked', () => {
        const mockOnClick = jest.fn();
        const propsWithClick = {
            ...baseProps,
            removeProps: {
                onClick: mockOnClick,
            },
        };

        const {container} = renderWithContext(
            <MultiUserProfilePill {...propsWithClick}/>,
            initialState,
        );

        const removeComponent = container.querySelector('.Remove');
        expect(removeComponent).toBeInTheDocument();
        expect(removeComponent).toBeDefined();

        fireEvent.click(removeComponent!);
        expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    test('should handle user profile without username gracefully', () => {
        const propsWithoutUsername = {
            ...baseProps,
            data: {
                ...baseProps.data,
                raw: {
                    ...baseProps.data.raw,
                    username: undefined,
                },
            },
        } as unknown as MultiValueProps<AutocompleteOptionType<UserProfile>, true>;

        const {container} = renderWithContext(
            <MultiUserProfilePill {...propsWithoutUsername}/>,
            initialState,
        );

        const pill = container.querySelector('.UserProfilePill');
        expect(pill).toBeInTheDocument();
    });

    test('should use different display name based on config', () => {
        const stateWithUsernameDisplay = {
            ...initialState,
            entities: {
                ...initialState.entities,
                general: {
                    config: {
                        TeammateNameDisplay: 'username',
                    },
                },
            },
        };

        const {container} = renderWithContext(
            <MultiUserProfilePill {...baseProps}/>,
            stateWithUsernameDisplay,
        );

        const pill = container.querySelector('.UserProfilePill');
        expect(pill).toBeInTheDocument();
    });

    test('should apply correct CSS classes', () => {
        const {container} = renderWithContext(
            <MultiUserProfilePill {...baseProps}/>,
            initialState,
        );

        const pill = container.querySelector('.UserProfilePill');
        expect(pill).toBeInTheDocument();
        expect(pill).toHaveClass('UserProfilePill');
    });
});
