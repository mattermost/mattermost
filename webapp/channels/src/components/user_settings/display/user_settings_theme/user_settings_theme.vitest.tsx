// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {Preferences} from 'mattermost-redux/constants';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/vitest_react_testing_utils';

import UserSettingsTheme from './user_settings_theme';

// Mock applyTheme due to JSDOM CSS selector limitations
vi.mock('utils/utils', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual as object,
        applyTheme: vi.fn(),
    };
});

describe('components/user_settings/display/user_settings_theme/user_settings_theme', () => {
    const requiredProps: ComponentProps<typeof UserSettingsTheme> = {
        theme: Preferences.THEMES.denim,
        currentTeamId: 'teamId',
        selected: false,
        updateSection: vi.fn(),
        setRequireConfirm: vi.fn(),
        actions: {
            saveTheme: vi.fn().mockResolvedValue({data: true}),
            deleteTeamSpecificThemes: vi.fn().mockResolvedValue({data: true}),
            openModal: vi.fn(),
        },
        allowCustomThemes: true,
        showAllTeamsCheckbox: true,
        applyToAllTeams: true,
        areAllSectionsInactive: false,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <UserSettingsTheme {...requiredProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should saveTheme', async () => {
        renderWithContext(
            <UserSettingsTheme
                {...requiredProps}
                selected={true}
            />,
        );

        const saveButton = screen.getByRole('button', {name: /save/i});
        await userEvent.click(saveButton);

        await waitFor(() => {
            expect(requiredProps.actions.saveTheme).toHaveBeenCalled();
        });
    });

    test('should deleteTeamSpecificThemes if applyToAllTeams is enabled', async () => {
        const props = {
            ...requiredProps,
            selected: true,
            applyToAllTeams: true,
        };

        renderWithContext(<UserSettingsTheme {...props}/>);

        const saveButton = screen.getByRole('button', {name: /save/i});
        await userEvent.click(saveButton);

        await waitFor(() => {
            expect(props.actions.deleteTeamSpecificThemes).toHaveBeenCalled();
        });
    });
});
