// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Preferences} from 'mattermost-redux/constants';

import CustomThemeChooser from 'components/user_settings/display/user_settings_theme/custom_theme_chooser/custom_theme_chooser';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

describe('components/user_settings/display/CustomThemeChooser', () => {
    const baseProps = {
        theme: Preferences.THEMES.denim,
        updateTheme: jest.fn(),
    };

    it('should match, init', () => {
        const {container} = renderWithContext(
            <CustomThemeChooser {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    it('should create a custom theme when the code theme changes', async () => {
        const {container} = renderWithContext(
            <CustomThemeChooser {...baseProps}/>,
        );

        await userEvent.click(container.querySelector('#codeThemeSelect') as HTMLButtonElement);
        await userEvent.click(screen.getByRole('option', {name: 'Monokai'}));

        expect(baseProps.updateTheme).toHaveBeenCalledTimes(1);
        expect(baseProps.updateTheme).toHaveBeenCalledWith({
            ...baseProps.theme,
            type: 'custom',
            codeTheme: 'monokai',
        });
    });
});
