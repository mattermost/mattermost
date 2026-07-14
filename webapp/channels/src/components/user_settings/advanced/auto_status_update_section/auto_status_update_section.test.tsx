// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Preferences} from 'mattermost-redux/constants';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import AutoStatusUpdateSection from 'components/user_settings/advanced/auto_status_update_section/auto_status_update_section';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

describe('components/user_settings/advanced/AutoStatusUpdateSection', () => {
    const defaultProps = {
        active: false,
        areAllSectionsInactive: false,
        userId: 'current_user_id',
        autoStatusUpdate: 'true',
        onUpdateSection: jest.fn(),
        renderOnOffLabel: jest.fn((label: string) => <span>{label === 'false' ? 'Off' : 'On'}</span>),
        actions: {
            savePreferences: jest.fn(() => {
                return new Promise<void>((resolve) => {
                    process.nextTick(() => resolve());
                });
            }),
        },
    };

    test('should render the collapsed setting with title', () => {
        renderWithContext(
            <AutoStatusUpdateSection {...defaultProps}/>,
        );

        expect(screen.queryByTestId('saveSetting')).not.toBeInTheDocument();
        expect(screen.getByText('Automatic status updates')).toBeInTheDocument();
    });

    test('should match state on handleOnChange', async () => {
        renderWithContext(
            <AutoStatusUpdateSection
                {...defaultProps}
                active={true}
            />,
        );

        const off = screen.getByRole('radio', {name: /off/i});
        const on = screen.getByRole('radio', {name: /on/i});

        expect(on).toBeChecked();

        await userEvent.click(off);
        expect(off).toBeChecked();

        await userEvent.click(on);
        expect(on).toBeChecked();
    });

    test('should call props.actions.savePreferences and props.onUpdateSection on handleSubmit', async () => {
        const actions = {
            savePreferences: jest.fn().mockImplementation(() => Promise.resolve({data: true})),
        };
        const onUpdateSection = jest.fn();
        renderWithContext(
            <AutoStatusUpdateSection
                {...defaultProps}
                active={true}
                actions={actions}
                onUpdateSection={onUpdateSection}
            />,
        );

        const autoStatusUpdatePreference = {
            category: 'advanced_settings',
            name: 'auto_status_update',
            user_id: 'current_user_id',
            value: 'true',
        };

        // Save with the initial value 'true'.
        await userEvent.click(screen.getByTestId('saveSetting'));
        expect(actions.savePreferences).toHaveBeenCalledTimes(1);
        expect(actions.savePreferences).toHaveBeenCalledWith('current_user_id', [autoStatusUpdatePreference]);
        expect(onUpdateSection).toHaveBeenCalledTimes(1);

        // Switch to 'false' and save again.
        await userEvent.click(screen.getByRole('radio', {name: /off/i}));
        autoStatusUpdatePreference.value = 'false';
        await userEvent.click(screen.getByTestId('saveSetting'));
        expect(actions.savePreferences).toHaveBeenCalledTimes(2);
        expect(actions.savePreferences).toHaveBeenCalledWith('current_user_id', [autoStatusUpdatePreference]);
    });

    test('should reset state and call props.onUpdateSection on cancel', async () => {
        const onUpdateSection = jest.fn();
        renderWithContext(
            <AutoStatusUpdateSection
                {...defaultProps}
                active={true}
                onUpdateSection={onUpdateSection}
            />,
        );

        await userEvent.click(screen.getByRole('radio', {name: /off/i}));
        expect(screen.getByRole('radio', {name: /off/i})).toBeChecked();

        await userEvent.click(screen.getByTestId('cancelButton'));
        expect(onUpdateSection).toHaveBeenCalledTimes(1);
    });
});

import {mapStateToProps} from './index';

describe('mapStateToProps', () => {
    const currentUserId = 'user-id';

    const initialState = {
        currentUserId,
        entities: {
            general: {
                config: {},
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

    test('defaults to true when no preference is set', () => {
        const props = mapStateToProps(initialState, {adminMode: false, userId: ''});
        expect(props.autoStatusUpdate).toEqual('true');
    });

    test('reads the user preference when present', () => {
        const testState = mergeObjects(initialState, {
            entities: {
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_ADVANCED_SETTINGS, Preferences.ADVANCED_AUTO_STATUS_UPDATE)]: {
                            category: Preferences.CATEGORY_ADVANCED_SETTINGS,
                            name: Preferences.ADVANCED_AUTO_STATUS_UPDATE,
                            value: 'false',
                        },
                    },
                },
            },
        });
        const props = mapStateToProps(testState, {adminMode: false, userId: ''});
        expect(props.autoStatusUpdate).toEqual('false');
    });

    test('reads from preferences in props in admin mode', () => {
        const userPreferences = {
            [getPreferenceKey(Preferences.CATEGORY_ADVANCED_SETTINGS, Preferences.ADVANCED_AUTO_STATUS_UPDATE)]: {
                category: Preferences.CATEGORY_ADVANCED_SETTINGS,
                name: Preferences.ADVANCED_AUTO_STATUS_UPDATE,
                user_id: 'user_1',
                value: 'false',
            },
        };

        const propsWithAdminMode = mapStateToProps(initialState, {
            userId: 'user_1',
            adminMode: true,
            userPreferences,
        });
        expect(propsWithAdminMode.autoStatusUpdate).toEqual('false');

        const propsWithoutAdminMode = mapStateToProps(initialState, {
            userId: 'user_1',
            adminMode: false,
            userPreferences,
        });
        expect(propsWithoutAdminMode.autoStatusUpdate).toEqual('true');
    });
});
