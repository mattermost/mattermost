// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {TimestampFormat} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

import * as preferencesActions from 'mattermost-redux/actions/preferences';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

import DateTimeDisplayFormatSetting from './date_time_display_format_setting';

describe('DateTimeDisplayFormatSetting', () => {
    const userId = 'user_id';

    const baseState: DeepPartial<GlobalState> = {
        entities: {
            users: {
                currentUserId: userId,
            },
            general: {
                config: {
                    DefaultTimestampFormat: TimestampFormat.STANDARD,
                    ShowTimestampSeconds: 'false',
                },
            },
            preferences: {
                myPreferences: {},
                userPreferences: {},
            },
        },
    };

    const baseProps: ComponentProps<typeof DateTimeDisplayFormatSetting> = {
        active: true,
        areAllSectionsInactive: false,
        updateSection: jest.fn(),
        configTimestampFormat: TimestampFormat.STANDARD,
        configShowTimestampSeconds: false,
        militaryTime: 'false',
        showTimestampSeconds: 'false',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('handleSubmit saves format preference when selection differs from system default', async () => {
        const savePreferences = jest.spyOn(preferencesActions, 'savePreferences').mockReturnValue({type: 'MOCK_SAVE'} as never);
        const updateSection = jest.fn();

        renderWithContext(
            <DateTimeDisplayFormatSetting
                {...baseProps}
                updateSection={updateSection}
            />,
            baseState,
        );

        await userEvent.click(screen.getByLabelText(/Relative \(example: 3 hours ago/i));
        await userEvent.click(screen.getByTestId('saveSetting'));

        expect(savePreferences).toHaveBeenCalledWith(userId, expect.arrayContaining([
            expect.objectContaining({
                category: Preferences.CATEGORY_DISPLAY_SETTINGS,
                name: Preferences.TIMESTAMP_FORMAT,
                value: TimestampFormat.RELATIVE,
            }),
        ]));
        expect(updateSection).toHaveBeenCalledWith('');
    });

    test('handleSubmit deletes format preference when selection matches system default', async () => {
        const savePreferences = jest.spyOn(preferencesActions, 'savePreferences').mockReturnValue({type: 'MOCK_SAVE'} as never);
        const deletePreferences = jest.spyOn(preferencesActions, 'deletePreferences').mockReturnValue({type: 'MOCK_DELETE'} as never);
        const updateSection = jest.fn();

        const state: DeepPartial<GlobalState> = {
            ...baseState,
            entities: {
                ...baseState.entities,
                preferences: {
                    myPreferences: {
                        [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.TIMESTAMP_FORMAT}`]: {
                            user_id: userId,
                            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
                            name: Preferences.TIMESTAMP_FORMAT,
                            value: TimestampFormat.RELATIVE,
                        },
                    },
                    userPreferences: {},
                },
            },
        };

        renderWithContext(
            <DateTimeDisplayFormatSetting
                {...baseProps}
                updateSection={updateSection}
            />,
            state,
        );

        await userEvent.click(screen.getByLabelText(/Standard \(example: 4:32 PM\)/i));
        await userEvent.click(screen.getByTestId('saveSetting'));

        expect(deletePreferences).toHaveBeenCalledWith(userId, expect.arrayContaining([
            expect.objectContaining({
                category: Preferences.CATEGORY_DISPLAY_SETTINGS,
                name: Preferences.TIMESTAMP_FORMAT,
                value: TimestampFormat.STANDARD,
            }),
        ]));
        expect(savePreferences).not.toHaveBeenCalled();
        expect(updateSection).toHaveBeenCalledWith('');
    });

    test('handleUpdateSection without section resets unsaved clock and format selections', async () => {
        const updateSection = jest.fn();

        renderWithContext(
            <DateTimeDisplayFormatSetting
                {...baseProps}
                updateSection={updateSection}
            />,
            baseState,
        );

        await userEvent.click(screen.getByLabelText(/24-hour clock \(example: 16:00\)/i));
        await userEvent.click(screen.getByLabelText(/Relative \(example: 3 hours ago/i));
        await userEvent.click(screen.getByLabelText(/Show seconds in timestamps/i));

        await userEvent.click(screen.getByTestId('cancelButton'));

        expect(screen.getByLabelText(/12-hour clock \(example: 4:00 PM\)/i)).toBeChecked();
        expect(screen.getByLabelText(/24-hour clock \(example: 16:00\)/i)).not.toBeChecked();
        expect(screen.getByLabelText(/Standard \(example: 4:32 PM\)/i)).toBeChecked();
        expect(screen.getByLabelText(/Relative \(example: 3 hours ago/i)).not.toBeChecked();
        expect(screen.getByLabelText(/Show seconds in timestamps/i)).not.toBeChecked();
        expect(updateSection).toHaveBeenCalledWith('');
    });
});
