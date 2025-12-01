// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Preferences} from 'mattermost-redux/constants';

import {renderWithContext, screen, userEvent} from 'tests/vitest_react_testing_utils';

import {CustomThemeChooser} from './custom_theme_chooser';

describe('components/user_settings/display/CustomThemeChooser', () => {
    const baseProps = {
        theme: Preferences.THEMES.denim,
        updateTheme: vi.fn(),
        intl: {formatMessage: vi.fn((msg) => msg.defaultMessage || msg.id)} as any,
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock document.querySelector for modal-body
        vi.spyOn(document, 'querySelector').mockReturnValue({
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        } as unknown as Element);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('should match, init', () => {
        const {container} = renderWithContext(
            <CustomThemeChooser {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should create a custom theme when the code theme changes', async () => {
        renderWithContext(
            <CustomThemeChooser {...baseProps}/>,
        );

        // Find the code theme select
        const codeThemeSelect = screen.getByRole('combobox');
        await userEvent.selectOptions(codeThemeSelect, 'monokai');

        expect(baseProps.updateTheme).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'custom',
                codeTheme: 'monokai',
            }),
        );
    });
});
