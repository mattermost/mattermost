// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {Preferences} from 'mattermost-redux/constants';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';
import JoinLeaveSection from 'components/user_settings/advanced/join_leave_section/join_leave_section';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {AdvancedSections} from 'utils/constants';

import type {GlobalState} from 'types/store';

describe('components/user_settings/advanced/JoinLeaveSection', () => {
    const defaultProps = {
        active: false,
        areAllSectionsInactive: false,
        userId: 'current_user_id',
        joinLeave: 'true',
        onUpdateSection: jest.fn(),
        renderOnOffLabel: jest.fn(),
        actions: {
            savePreferences: jest.fn(() => {
                return new Promise<void>((resolve) => {
                    process.nextTick(() => resolve());
                });
            }),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <JoinLeaveSection {...defaultProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find(SettingItemMax).exists()).toEqual(false);
        expect(wrapper.find(SettingItemMin).exists()).toEqual(true);

        wrapper.setProps({active: true});
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find(SettingItemMax).exists()).toEqual(true);
        expect(wrapper.find(SettingItemMin).exists()).toEqual(false);
    });

    test('should match state on handleOnChange', () => {
        const wrapper = shallow<JoinLeaveSection>(
            <JoinLeaveSection {...defaultProps}/>,
        );

        wrapper.setState({joinLeaveState: 'true'});

        let value = 'false';
        wrapper.instance().handleOnChange({currentTarget: {value}} as any);
        expect(wrapper.state('joinLeaveState')).toEqual('false');

        value = 'true';
        wrapper.instance().handleOnChange({currentTarget: {value}} as any);
        expect(wrapper.state('joinLeaveState')).toEqual('true');
    });

    test('should call props.actions.savePreferences and props.onUpdateSection on handleSubmit', () => {
        const actions = {
            savePreferences: jest.fn().mockImplementation(() => Promise.resolve({data: true})),
        };
        const onUpdateSection = jest.fn();
        const wrapper = shallow<JoinLeaveSection>(
            <JoinLeaveSection
                {...defaultProps}
                actions={actions}
                onUpdateSection={onUpdateSection}
            />,
        );

        const joinLeavePreference = {
            category: 'advanced_settings',
            name: 'join_leave',
            user_id: 'current_user_id',
            value: 'true',
        };

        const instance = wrapper.instance();
        instance.handleSubmit();
        expect(actions.savePreferences).toHaveBeenCalledTimes(1);
        expect(actions.savePreferences).toHaveBeenCalledWith('current_user_id', [joinLeavePreference]);
        expect(onUpdateSection).toHaveBeenCalledTimes(1);

        wrapper.setState({joinLeaveState: 'false'});
        joinLeavePreference.value = 'false';
        instance.handleSubmit();
        expect(actions.savePreferences).toHaveBeenCalledTimes(2);
        expect(actions.savePreferences).toHaveBeenCalledWith('current_user_id', [joinLeavePreference]);
    });

    test('should match state and call props.onUpdateSection on handleUpdateSection', () => {
        const onUpdateSection = jest.fn();
        const wrapper = shallow<JoinLeaveSection>(
            <JoinLeaveSection
                {...defaultProps}
                onUpdateSection={onUpdateSection}
            />,
        );

        wrapper.setState({joinLeaveState: 'false'});

        const instance = wrapper.instance();
        instance.handleUpdateSection();
        expect(wrapper.state('joinLeaveState')).toEqual(defaultProps.joinLeave);
        expect(onUpdateSection).toHaveBeenCalledTimes(1);

        wrapper.setState({joinLeaveState: 'false'});
        instance.handleUpdateSection(AdvancedSections.JOIN_LEAVE);
        expect(onUpdateSection).toHaveBeenCalledTimes(2);
        expect(onUpdateSection).toBeCalledWith(AdvancedSections.JOIN_LEAVE);
    });
});

import {mapStateToProps} from './index';

describe('mapStateToProps', () => {
    const currentUserId = 'user-id';

    const initialState = {
        currentUserId,
        entities: {
            general: {
                config: {
                    EnableJoinLeaveMessageByDefault: 'true',
                },
            },
            preferences: {
                myPreferences: {},
            },
            users: {
                currentUserId,
                profiles: {
                    [currentUserId]: {
                        id: currentUserId,
                    },
                },
            },

        },
    } as unknown as GlobalState;

    test('configuration default to true', () => {
        const props = mapStateToProps(initialState, {adminMode: false, userId: ''});
        expect(props.joinLeave).toEqual('true');
    });

    test('configuration default to false', () => {
        const testState = mergeObjects(initialState, {
            entities: {
                general: {
                    config: {
                        EnableJoinLeaveMessageByDefault: 'false',
                    },
                },
            },
        });
        const props = mapStateToProps(testState, {userId: '', adminMode: false});
        expect(props.joinLeave).toEqual('false');
    });

    test('user setting takes presidence', () => {
        const testState = mergeObjects(initialState, {
            entities: {
                general: {
                    config: {
                        EnableJoinDefault: 'false',
                    },
                },
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_ADVANCED_SETTINGS, Preferences.ADVANCED_FILTER_JOIN_LEAVE)]: {
                            category: Preferences.CATEGORY_ADVANCED_SETTINGS,
                            name: Preferences.ADVANCED_FILTER_JOIN_LEAVE,
                            value: 'true',
                        },
                    },
                },
            },
        });
        const props = mapStateToProps(testState, {adminMode: false, userId: ''});
        expect(props.joinLeave).toEqual('true');
    });

    test('user setting takes presidence opposite', () => {
        const testState = mergeObjects(initialState, {
            entities: {
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_ADVANCED_SETTINGS, Preferences.ADVANCED_FILTER_JOIN_LEAVE)]: {
                            category: Preferences.CATEGORY_ADVANCED_SETTINGS,
                            name: Preferences.ADVANCED_FILTER_JOIN_LEAVE,
                            value: 'false',
                        },
                    },
                },
            },
        });
        const props = mapStateToProps(testState, {adminMode: false, userId: ''});
        expect(props.joinLeave).toEqual('false');
    });

    test('should read from preferences in props in admin mode', () => {
        const testState = mergeObjects(initialState, {
            entities: {
                general: {
                    config: {
                        EnableJoinLeaveMessageByDefault: 'false',
                    },
                },
            },
        });

        const userPreferences = {
            [getPreferenceKey(Preferences.CATEGORY_ADVANCED_SETTINGS, Preferences.ADVANCED_FILTER_JOIN_LEAVE)]: {
                category: Preferences.CATEGORY_ADVANCED_SETTINGS,
                name: Preferences.ADVANCED_FILTER_JOIN_LEAVE,
                user_id: 'user_1',
                value: 'true',
            },
        };

        const propsWithAdminMode = mapStateToProps(testState, {
            userId: 'user_1',
            adminMode: true,
            userPreferences,
        });
        expect(propsWithAdminMode.joinLeave).toEqual('true');

        const propsWithoutAdminMode = mapStateToProps(testState, {
            userId: 'user_1',
            adminMode: false,
            userPreferences,
        });
        expect(propsWithoutAdminMode.joinLeave).toEqual('false');
    });
});
