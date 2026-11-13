// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {LocalizationSettings} from '@mattermost/types/config';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import Localization from './localization';

import type {SystemConsoleCustomSettingsComponentProps} from '../schema_admin_settings';

describe('components/admin_console/localization/Localization', () => {
    test('renders the Available Languages help text without external links', () => {
        const props = {
            id: 'LocalizationSettings',
            value: {
                DefaultServerLocale: 'en',
                DefaultClientLocale: 'en',
                AvailableLocales: '',
            } as LocalizationSettings,
            disabled: false,
            setByEnv: false,
            onChange: jest.fn(),
        } as unknown as SystemConsoleCustomSettingsComponentProps;

        renderWithContext(<Localization {...props}/>);

        expect(screen.getByText(/Set which languages are available for users in/)).toBeInTheDocument();
        expect(screen.getByText('Settings > Display > Language')).toBeInTheDocument();
        expect(screen.getByText('Default Client Language')).toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
});
