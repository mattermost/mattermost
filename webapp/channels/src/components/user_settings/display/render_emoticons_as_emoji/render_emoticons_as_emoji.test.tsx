// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';

import RenderEmoticonsAsEmoji from './render_emoticons_as_emoji';

describe('components/user_settings/display/render_emoticons_as_emoji/render_emoticons_as_emoji', () => {
    const user = {
        id: 'user_id',
        username: 'username',
        locale: 'en',
        timezone: {
            useAutomaticTimezone: 'true',
            automaticTimezone: 'America/New_York',
            manualTimezone: '',
        },
    };

    const props = {
        user: user as UserProfile,
        renderEmoticonsAsEmoji: 'true',
        updateSection: jest.fn(),
        adminMode: false,
        userPreferences: undefined,
        actions: {
            savePreferences: jest.fn(() => {
                return new Promise<void>((resolve) => {
                    process.nextTick(() => resolve());
                });
            })},
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(<RenderEmoticonsAsEmoji {...props}/>);

        expect(container).toMatchSnapshot();
    });

    test('should call updateSection on submit', async () => {
        const {getByRole, getByLabelText} = renderWithContext(<RenderEmoticonsAsEmoji {...props}/>);

        const radioButtonOff = getByLabelText(/off/i);
        await userEvent.click(radioButtonOff);

        const submitButton = getByRole('button', {name: /save/i});
        await userEvent.click(submitButton);

        expect(props.actions.savePreferences).toHaveBeenCalled();
        expect(props.updateSection).toHaveBeenCalledWith('');
    });
});
