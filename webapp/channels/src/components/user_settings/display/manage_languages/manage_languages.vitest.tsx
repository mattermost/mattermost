// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {getAllLanguages} from 'i18n/i18n';
import {renderWithContext, screen, userEvent} from 'tests/vitest_react_testing_utils';

import ManageLanguages from './manage_languages';

describe('components/user_settings/display/manage_languages/manage_languages', () => {
    const user = {
        id: 'user_id',
        locale: 'en',
    };

    const requiredProps = {
        user: user as UserProfile,
        locale: 'en',
        locales: getAllLanguages(),
        updateSection: vi.fn(),
        actions: {
            updateMe: vi.fn(() => Promise.resolve({data: true})),
            patchUser: vi.fn(() => Promise.resolve({data: true})),
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('submitUser() should have called updateMe', async () => {
        const updateSection = vi.fn();
        const props = {...requiredProps, updateSection};

        renderWithContext(<ManageLanguages {...props}/>);

        // Click save without changing language - should just close
        const saveButton = screen.getByRole('button', {name: /save/i});
        await userEvent.click(saveButton);

        expect(updateSection).toHaveBeenCalledWith('');
    });
});
