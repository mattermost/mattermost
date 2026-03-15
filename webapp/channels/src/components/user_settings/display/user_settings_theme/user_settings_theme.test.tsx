// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {Preferences} from 'mattermost-redux/constants';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import UserSettingsTheme from './user_settings_theme';

jest.mock('utils/utils', () => ({
    applyTheme: jest.fn(),
    toTitleCase: jest.fn(),
    a11yFocus: jest.fn(),
}));

describe('components/user_settings/display/user_settings_theme/user_settings_theme', () => {
    const requiredProps: ComponentProps<typeof UserSettingsTheme> = {
        theme: Preferences.THEMES.denim,
        currentTeamId: 'teamId',
        selected: false,
        updateSection: jest.fn(),
        setRequireConfirm: jest.fn(),
        actions: {
            saveTheme: jest.fn().mockResolvedValue({data: true}),
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
        expect(requiredProps.actions.saveTheme).toHaveBeenCalled();
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
                saveTheme: jest.fn().mockResolvedValue({data: true}),
                deleteTeamSpecificThemes: jest.fn().mockResolvedValue({data: true}),
                openModal: jest.fn(),
            },
        };

        renderWithContext(
            <UserSettingsTheme {...props}/>,
        );

        // The applyToAllTeams checkbox should be checked by default (from props)
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeChecked();

        // Click Save to trigger submitTheme
        const saveButton = screen.getByText('Save');
        await userEvent.click(saveButton);

        await waitFor(() => {
            expect(props.actions.deleteTeamSpecificThemes).toHaveBeenCalled();
        });
    });
});
