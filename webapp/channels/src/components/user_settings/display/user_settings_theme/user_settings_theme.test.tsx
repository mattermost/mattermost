// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {Preferences} from 'mattermost-redux/constants';

import matchMedia from 'tests/helpers/match_media.mock';
import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import UserSettingsTheme from './user_settings_theme';

jest.mock('utils/utils', () => ({
    applyTheme: jest.fn(),
    toTitleCase: (s: string) => s,
    a11yFocus: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {applyTheme} = require('utils/utils');

describe('components/user_settings/display/user_settings_theme/user_settings_theme', () => {
    const requiredProps: ComponentProps<typeof UserSettingsTheme> = {
        theme: Preferences.THEMES.denim,
        currentTeamId: 'teamId',
        selected: false,
        updateSection: jest.fn(),
        setRequireConfirm: jest.fn(),
        themeAutoSwitch: false,
        actions: {
            saveThemePreferences: jest.fn().mockResolvedValue({data: true}),
            deleteTeamSpecificThemes: jest.fn().mockResolvedValue({data: true}),
            openModal: jest.fn(),
        },
        allowCustomThemes: true,
        showAllTeamsCheckbox: true,
        applyToAllTeams: true,
        areAllSectionsInactive: false,
    };

    it('should match snapshot', () => {
        const {container} = renderWithContext(
            <UserSettingsTheme {...requiredProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    it('should saveTheme', async () => {
        const props = {
            ...requiredProps,
            selected: true,
        };

        renderWithContext(
            <UserSettingsTheme {...props}/>,
        );

        // Click the Save button to trigger submitTheme
        const saveButton = screen.getByText('Save');
        await userEvent.click(saveButton);

        await waitFor(() => {
            expect(requiredProps.setRequireConfirm).toHaveBeenCalledWith(false);
        });

        expect(requiredProps.updateSection).toHaveBeenCalledWith('');
        expect(requiredProps.actions.saveThemePreferences).toHaveBeenCalled();
    });

    it('should show premade themes when custom themes are disabled', () => {
        const props = {
            ...requiredProps,
            selected: true,
            allowCustomThemes: false,
        };

        renderWithContext(
            <UserSettingsTheme {...props}/>,
        );

        // Premade theme chooser should still be rendered
        expect(screen.getByText('Save')).toBeInTheDocument();
        expect(screen.queryByLabelText('Premade Themes')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Custom Theme')).not.toBeInTheDocument();

        // The premade themes should be visible (theme thumbnails are rendered)
        const premadeThemes = document.querySelectorAll('.premade-themes');
        expect(premadeThemes.length).toBeGreaterThan(0);
    });

    it('should deleteTeamSpecificThemes if applyToAllTeams is enabled', async () => {
        const props = {
            ...requiredProps,
            selected: true,
            actions: {
                saveThemePreferences: jest.fn().mockResolvedValue({data: true}),
                deleteTeamSpecificThemes: jest.fn().mockResolvedValue({data: true}),
                openModal: jest.fn(),
            },
        };

        renderWithContext(
            <UserSettingsTheme {...props}/>,
        );

        // The applyToAllTeams checkbox should be checked by default (from props)
        const checkbox = screen.getByRole('checkbox', {name: /apply new theme to all my teams/i});
        expect(checkbox).toBeChecked();

        // Click Save to trigger submitTheme
        const saveButton = screen.getByText('Save');
        await userEvent.click(saveButton);

        await waitFor(() => {
            expect(props.actions.deleteTeamSpecificThemes).toHaveBeenCalled();
        });
    });

    describe('auto-switch', () => {
        beforeEach(() => {
            applyTheme.mockClear();
        });

        afterEach(() => {
            matchMedia.clear();
        });

        it('tells Desktop to follow the system theme when auto-switch is toggled on before save', async () => {
            matchMedia.useMediaQuery('(prefers-color-scheme: dark)');

            renderWithContext(
                <UserSettingsTheme
                    {...requiredProps}
                    selected={true}
                />,
            );

            await userEvent.click(screen.getByRole('checkbox', {name: /automatically switch between light and dark themes/i}));

            expect(applyTheme).toHaveBeenCalledWith(
                expect.objectContaining({type: Preferences.THEMES.onyx.type}),
                {isUsingSystemTheme: true},
            );
        });

        it('hides dark premades from the light chooser and light premades from the dark chooser', () => {
            renderWithContext(
                <UserSettingsTheme
                    {...requiredProps}
                    selected={true}
                    themeAutoSwitch={true}
                    darkTheme={Preferences.THEMES.onyx}
                />,
            );

            const sections = document.querySelectorAll('.appearance-section');
            expect(sections).toHaveLength(2);

            const lightIds = Array.from(sections[0].querySelectorAll('.premadeThemeButton')).map((el) => el.id);
            expect(lightIds).toEqual(expect.arrayContaining(['premadeThemeDenim', 'premadeThemeSapphire', 'premadeThemeQuartz']));
            expect(lightIds).not.toEqual(expect.arrayContaining(['premadeThemeOnyx', 'premadeThemeIndigo']));

            const darkIds = Array.from(sections[1].querySelectorAll('.premadeThemeButton')).map((el) => el.id);
            expect(darkIds).toEqual(expect.arrayContaining(['premadeThemeOnyx', 'premadeThemeIndigo']));
            expect(darkIds).not.toEqual(expect.arrayContaining(['premadeThemeDenim', 'premadeThemeSapphire', 'premadeThemeQuartz']));
        });
    });
});
