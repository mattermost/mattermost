// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Preferences} from 'mattermost-redux/constants';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {renderWithContext, screen, userEvent} from 'tests/vitest_react_testing_utils';

import type {GlobalState} from 'types/store';

import JoinLeaveSection from './join_leave_section';

describe('components/user_settings/advanced/JoinLeaveSection', () => {
    const defaultProps = {
        active: false,
        areAllSectionsInactive: false,
        userId: 'current_user_id',
        joinLeave: 'true',
        onUpdateSection: vi.fn(),
        renderOnOffLabel: vi.fn((label: string) => (label === 'true' ? 'On' : 'Off')),
        actions: {
            savePreferences: vi.fn(() => {
                return new Promise<void>((resolve) => {
                    process.nextTick(() => resolve());
                });
            }),
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('should match snapshot', () => {
        const {container, rerender} = renderWithContext(
            <JoinLeaveSection {...defaultProps}/>,
        );

        expect(container).toMatchSnapshot();

        // When not active, should show SettingItemMin
        expect(screen.getByText('Enable Join/Leave Messages')).toBeInTheDocument();

        rerender(
            <JoinLeaveSection
                {...defaultProps}
                active={true}
            />,
        );
        expect(container).toMatchSnapshot();

        // When active, should show radio buttons
        expect(screen.getByLabelText('On')).toBeInTheDocument();
        expect(screen.getByLabelText('Off')).toBeInTheDocument();
    });

    test('should match state on handleOnChange', async () => {
        renderWithContext(
            <JoinLeaveSection
                {...defaultProps}
                active={true}
            />,
        );

        const offRadio = screen.getByLabelText('Off');
        const onRadio = screen.getByLabelText('On');

        // Initially "true" should be checked
        expect(onRadio).toBeChecked();
        expect(offRadio).not.toBeChecked();

        // Click off radio
        await userEvent.click(offRadio);
        expect(offRadio).toBeChecked();
        expect(onRadio).not.toBeChecked();

        // Click on radio
        await userEvent.click(onRadio);
        expect(onRadio).toBeChecked();
        expect(offRadio).not.toBeChecked();
    });

    test('should call props.actions.savePreferences and props.onUpdateSection on handleSubmit', async () => {
        const actions = {
            savePreferences: vi.fn().mockImplementation(() => Promise.resolve({data: true})),
        };
        const onUpdateSection = vi.fn();

        renderWithContext(
            <JoinLeaveSection
                {...defaultProps}
                active={true}
                actions={actions}
                onUpdateSection={onUpdateSection}
            />,
        );

        // Submit with default value 'true'
        const saveButton = screen.getByRole('button', {name: /save/i});
        await userEvent.click(saveButton);

        expect(actions.savePreferences).toHaveBeenCalledTimes(1);
        expect(actions.savePreferences).toHaveBeenCalledWith('current_user_id', [{
            category: 'advanced_settings',
            name: 'join_leave',
            user_id: 'current_user_id',
            value: 'true',
        }]);
        expect(onUpdateSection).toHaveBeenCalledTimes(1);
    });

    test('should match state and call props.onUpdateSection on handleUpdateSection', async () => {
        const onUpdateSection = vi.fn();

        renderWithContext(
            <JoinLeaveSection
                {...defaultProps}
                active={true}
                onUpdateSection={onUpdateSection}
            />,
        );

        const cancelButton = screen.getByRole('button', {name: /cancel/i});
        await userEvent.click(cancelButton);

        expect(onUpdateSection).toHaveBeenCalled();
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
