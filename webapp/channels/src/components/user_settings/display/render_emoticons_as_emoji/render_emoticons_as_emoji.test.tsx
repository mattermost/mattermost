// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {IntlProvider} from 'react-intl';

import {render, userEvent} from 'tests/react_testing_utils';

import RenderEmoticonsAsEmoji from './render_emoticons_as_emoji';

describe('components/user_settings/display/render_emoticons_as_emoji/render_emoticons_as_emoji', () => {
    const baseProps = {
        active: true,
        areAllSectionsInactive: false,
        userId: 'current_user_id',
        renderEmoticonsAsEmoji: 'true',
        updateSection: jest.fn(),
        renderOnOffLabel: jest.fn(() => 'Test Label'),
        actions: {
            savePreferences: jest.fn(() => {
                return new Promise<void>((resolve) => {
                    process.nextTick(() => resolve());
                });
            })},
    };

    const intlProviderProps = {
        defaultLocale: 'en',
        locale: 'en',
    };

    test('should match snapshot', () => {
        const {container} = render(
            <IntlProvider {...intlProviderProps}>
                <RenderEmoticonsAsEmoji {...baseProps}/>
            </IntlProvider>);

        expect(container.firstChild).toMatchSnapshot();
    });

    test('should call updateSection on submit', async () => {
        const {getByRole, getByLabelText} = render(
            <IntlProvider {...intlProviderProps}>
                <RenderEmoticonsAsEmoji {...baseProps}/>
            </IntlProvider>);

        const radioButtonOn = getByLabelText(/on/i);
        userEvent.click(radioButtonOn);

        const submitButton = getByRole('button', {name: /save/i});
        userEvent.click(submitButton);

        expect(baseProps.actions.savePreferences).toHaveBeenCalled();
        expect(baseProps.updateSection).toHaveBeenCalledWith('');
    });
});
