// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Preferences} from 'mattermost-redux/constants';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import PremadeThemeChooser from './index';

const allThemeKeys = Object.keys(Preferences.THEMES);

const renderChooser = (allowedThemes?: string) => {
    return renderWithContext(
        <PremadeThemeChooser
            theme={Preferences.THEMES.denim}
            updateTheme={jest.fn()}
        />,
        {
            entities: {
                general: {
                    config: allowedThemes === undefined ? {} : {AllowedThemes: allowedThemes},
                },
            },
        },
    );
};

describe('components/user_settings/display/premade_theme_chooser', () => {
    test('renders every premade theme when ThemeSettings.AllowedThemes is unset', () => {
        renderChooser();

        expect(document.querySelectorAll('.premade-themes')).toHaveLength(allThemeKeys.length);
    });

    test('renders every premade theme when ThemeSettings.AllowedThemes is empty', () => {
        renderChooser('');

        expect(document.querySelectorAll('.premade-themes')).toHaveLength(allThemeKeys.length);
    });

    test('renders only the themes listed in ThemeSettings.AllowedThemes', () => {
        renderChooser('denim,onyx');

        expect(document.querySelectorAll('.premade-themes')).toHaveLength(2);
        expect(screen.getByText('Denim')).toBeInTheDocument();
        expect(screen.getByText('Onyx')).toBeInTheDocument();
        expect(screen.queryByText('Sapphire')).not.toBeInTheDocument();
        expect(screen.queryByText('Quartz')).not.toBeInTheDocument();
        expect(screen.queryByText('Indigo')).not.toBeInTheDocument();
    });

    test('enforces a single allowed theme', () => {
        renderChooser('onyx');

        expect(document.querySelectorAll('.premade-themes')).toHaveLength(1);
        expect(screen.getByText('Onyx')).toBeInTheDocument();
        expect(screen.queryByText('Denim')).not.toBeInTheDocument();
    });

    test('ignores the whitespace surrounding the themes listed in ThemeSettings.AllowedThemes', () => {
        renderChooser(' denim , onyx ');

        expect(document.querySelectorAll('.premade-themes')).toHaveLength(2);
        expect(screen.getByText('Denim')).toBeInTheDocument();
        expect(screen.getByText('Onyx')).toBeInTheDocument();
        expect(screen.queryByText('Sapphire')).not.toBeInTheDocument();
    });

    test('ignores the empty entries in ThemeSettings.AllowedThemes', () => {
        renderChooser('onyx,,');

        expect(document.querySelectorAll('.premade-themes')).toHaveLength(1);
        expect(screen.getByText('Onyx')).toBeInTheDocument();
        expect(screen.queryByText('Denim')).not.toBeInTheDocument();
    });

    test('renders every premade theme when ThemeSettings.AllowedThemes is only whitespace', () => {
        renderChooser(' , ');

        expect(document.querySelectorAll('.premade-themes')).toHaveLength(allThemeKeys.length);
    });
});
