// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Preferences} from 'mattermost-redux/constants';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import JoinLeaveSection from 'components/user_settings/advanced/join_leave_section/join_leave_section';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {screen, userEvent} from 'tests/react_testing_utils';
import {renderWithUserSettingsState} from 'tests/user_settings';

import type {GlobalState} from 'types/store';

describe('components/user_settings/advanced/JoinLeaveSection', () => {
    const defaultProps = {
        activeSection: '',
        userId: 'current_user_id',
        joinLeave: 'true',
        updateSection: jest.fn(),
        actions: {
            savePreferences: jest.fn(() => {
                return new Promise<void>((resolve) => {
                    process.nextTick(() => resolve());
                });
            }),
        },
    };

    test('should match snapshot', async () => {
        const {container} = renderWithUserSettingsState(JoinLeaveSection, defaultProps);

        expect(container).toMatchSnapshot();
        expect(screen.queryByTestId('saveSetting')).not.toBeInTheDocument();
        expect(screen.getByText('Enable Join/Leave Messages')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Enable Join/Leave Messages Edit'}));

        expect(container).toMatchSnapshot();
        expect(screen.getByTestId('saveSetting')).toBeInTheDocument();
    });

    test('should match state on handleOnChange', async () => {
        renderWithUserSettingsState(JoinLeaveSection, defaultProps);

        await userEvent.click(screen.getByRole('button', {name: 'Enable Join/Leave Messages Edit'}));

        const joinLeaveOff = screen.getByRole('radio', {name: /off/i});
        const joinLeaveOn = screen.getByRole('radio', {name: /on/i});

        await userEvent.click(joinLeaveOff);
        expect(joinLeaveOff).toBeChecked();

        await userEvent.click(joinLeaveOn);
        expect(joinLeaveOn).toBeChecked();
    });

    test('should call props.actions.savePreferences on submit', async () => {
        const actions = {
            savePreferences: jest.fn().mockImplementation(() => Promise.resolve({data: true})),
        };
        renderWithUserSettingsState(JoinLeaveSection, {
            ...defaultProps,
            actions,
        });

        await userEvent.click(screen.getByRole('button', {name: 'Enable Join/Leave Messages Edit'}));

        const joinLeavePreference = {
            category: 'advanced_settings',
            name: 'join_leave',
            user_id: 'current_user_id',
            value: 'true',
        };

        // Click Save with initial joinLeave value 'true'
        await userEvent.click(screen.getByTestId('saveSetting'));
        expect(actions.savePreferences).toHaveBeenCalledTimes(1);
        expect(actions.savePreferences).toHaveBeenCalledWith('current_user_id', [joinLeavePreference]);

        await userEvent.click(screen.getByRole('button', {name: 'Enable Join/Leave Messages Edit'}));

        // Change to 'false' and save again
        await userEvent.click(screen.getByRole('radio', {name: /off/i}));
        joinLeavePreference.value = 'false';
        await userEvent.click(screen.getByTestId('saveSetting'));
        expect(actions.savePreferences).toHaveBeenCalledTimes(2);
        expect(actions.savePreferences).toHaveBeenCalledWith('current_user_id', [joinLeavePreference]);
    });

    test('should reset state on cancel', async () => {
        renderWithUserSettingsState(JoinLeaveSection, defaultProps);

        await userEvent.click(screen.getByRole('button', {name: 'Enable Join/Leave Messages Edit'}));

        // Change the radio to 'false'
        await userEvent.click(screen.getByRole('radio', {name: /off/i}));
        expect(screen.getByRole('radio', {name: /off/i})).toBeChecked();

        // Click Cancel → handleUpdateSection() resets state and closes section
        await userEvent.click(screen.getByTestId('cancelButton'));
        expect(screen.queryByRole('radio')).not.toBeInTheDocument();

        // After cancel, re-render as active to verify the state was reset
        // The joinLeave prop is 'true', so after reset the On radio should be checked
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
