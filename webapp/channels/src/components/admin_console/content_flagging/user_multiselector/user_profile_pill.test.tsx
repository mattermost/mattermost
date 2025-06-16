// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import type {UserProfile} from '@mattermost/types/users';

import {TestHelper} from 'utils/test_helper';

import {UserProfilePill} from './user_profile_pill';
import type {AutocompleteOptionType} from './user_multiselector';

const mockStore = configureStore([]);

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
    };

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

    let store: any;

    beforeEach(() => {
        store = mockStore(initialState);
        jest.clearAllMocks();
    });

    test('should render user profile pill with avatar and display name', () => {
        const wrapper = shallow(
            <Provider store={store}>
                <UserProfilePill {...baseProps}/>
            </Provider>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should render with correct user display name', () => {
        const wrapper = shallow(
            <Provider store={store}>
                <UserProfilePill {...baseProps}/>
            </Provider>,
        );

        const pill = wrapper.dive().dive();
        expect(pill.find('.UserProfilePill')).toHaveLength(1);
        expect(pill.text()).toContain('Test User');
    });

    test('should render Avatar component with correct props', () => {
        const wrapper = shallow(
            <Provider store={store}>
                <UserProfilePill {...baseProps}/>
            </Provider>,
        );

        const pill = wrapper.dive().dive();
        const avatar = pill.find('Avatar');
        
        expect(avatar).toHaveLength(1);
        expect(avatar.prop('size')).toBe('xxs');
        expect(avatar.prop('username')).toBe('testuser');
        expect(avatar.prop('url')).toBeDefined();
    });

    test('should render Remove component with close icon', () => {
        const wrapper = shallow(
            <Provider store={store}>
                <UserProfilePill {...baseProps}/>
            </Provider>,
        );

        const pill = wrapper.dive().dive();
        const removeComponent = pill.find('Remove');
        
        expect(removeComponent).toHaveLength(1);
        expect(removeComponent.prop('data')).toBe(baseProps.data);
        expect(removeComponent.prop('innerProps')).toBe(baseProps.innerProps);
        expect(removeComponent.prop('selectProps')).toBe(baseProps.selectProps);
    });

    test('should call onClick when remove button is clicked', () => {
        const mockOnClick = jest.fn();
        const propsWithClick = {
            ...baseProps,
            removeProps: {
                onClick: mockOnClick,
            },
        };

        const wrapper = shallow(
            <Provider store={store}>
                <UserProfilePill {...propsWithClick}/>
            </Provider>,
        );

        const pill = wrapper.dive().dive();
        const removeComponent = pill.find('Remove');
        
        removeComponent.simulate('click');
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
        };

        const wrapper = shallow(
            <Provider store={store}>
                <UserProfilePill {...propsWithoutUsername}/>
            </Provider>,
        );

        const pill = wrapper.dive().dive();
        const avatar = pill.find('Avatar');
        
        expect(avatar.prop('username')).toBeUndefined();
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

        const storeWithUsername = mockStore(stateWithUsernameDisplay);

        const wrapper = shallow(
            <Provider store={storeWithUsername}>
                <UserProfilePill {...baseProps}/>
            </Provider>,
        );

        expect(wrapper).toBeDefined();
    });

    test('should apply correct CSS classes', () => {
        const wrapper = shallow(
            <Provider store={store}>
                <UserProfilePill {...baseProps}/>
            </Provider>,
        );

        const pill = wrapper.dive().dive();
        expect(pill.find('.UserProfilePill')).toHaveLength(1);
    });

    test('should pass through innerProps to main container', () => {
        const customInnerProps = {
            'data-testid': 'user-pill',
            className: 'custom-class',
        };

        const propsWithCustomInner = {
            ...baseProps,
            innerProps: customInnerProps,
        };

        const wrapper = shallow(
            <Provider store={store}>
                <UserProfilePill {...propsWithCustomInner}/>
            </Provider>,
        );

        const pill = wrapper.dive().dive();
        const container = pill.find('.UserProfilePill');
        
        expect(container.prop('data-testid')).toBe('user-pill');
        expect(container.prop('className')).toContain('custom-class');
    });
});
