// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {Preferences} from 'mattermost-redux/constants';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {applyTheme} from 'utils/utils';

import UserSettingsTheme from './user_settings_theme';

jest.mock('utils/utils', () => ({
    applyTheme: jest.fn(),
    toTitleCase: jest.fn((text: string) => text),
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

    describe('unsaved changes detection', () => {
        const openProps = {
            ...requiredProps,
            selected: true,
            theme: Preferences.THEMES.denim,
        };

        it('should not require confirmation when re-selecting the theme already in use', async () => {
            const setRequireConfirm = jest.fn();

            renderWithContext(
                <UserSettingsTheme
                    {...openProps}
                    setRequireConfirm={setRequireConfirm}
                />,
            );

            await userEvent.click(screen.getByRole('button', {name: /Denim/}));

            expect(setRequireConfirm).toHaveBeenCalledWith(false);
            expect(setRequireConfirm).not.toHaveBeenCalledWith(true);
            expect(applyTheme).toHaveBeenCalledWith(expect.objectContaining({type: 'Denim'}));
        });

        it('should require confirmation when selecting a different theme', async () => {
            const setRequireConfirm = jest.fn();

            renderWithContext(
                <UserSettingsTheme
                    {...openProps}
                    setRequireConfirm={setRequireConfirm}
                />,
            );

            await userEvent.click(screen.getByRole('button', {name: /Onyx/}));

            expect(setRequireConfirm).toHaveBeenCalledWith(true);
            expect(applyTheme).toHaveBeenCalledWith(expect.objectContaining({type: 'Onyx'}));
        });

        it('should stop requiring confirmation when the saved theme is selected again', async () => {
            const setRequireConfirm = jest.fn();

            renderWithContext(
                <UserSettingsTheme
                    {...openProps}
                    setRequireConfirm={setRequireConfirm}
                />,
            );

            await userEvent.click(screen.getByRole('button', {name: /Onyx/}));
            expect(setRequireConfirm).toHaveBeenLastCalledWith(true);

            await userEvent.click(screen.getByRole('button', {name: /Denim/}));
            expect(setRequireConfirm).toHaveBeenLastCalledWith(false);
        });

        it('should require confirmation when a custom theme value is changed', async () => {
            const setRequireConfirm = jest.fn();

            renderWithContext(
                <UserSettingsTheme
                    {...openProps}
                    setRequireConfirm={setRequireConfirm}
                />,
            );

            await userEvent.click(screen.getByRole('radio', {name: 'Custom Theme'}));
            expect(setRequireConfirm).not.toHaveBeenCalled();

            await userEvent.selectOptions(screen.getByLabelText('Code Theme'), 'monokai');

            expect(setRequireConfirm).toHaveBeenLastCalledWith(true);
            expect(applyTheme).toHaveBeenLastCalledWith(expect.objectContaining({codeTheme: 'monokai'}));
        });
    });
});
