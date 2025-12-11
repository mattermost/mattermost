// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import AddBot from './add_bot';

describe('components/integrations/bots/AddBot', () => {
    const team = TestHelper.getTeamMock();

    const actions = {
        createBot: vi.fn(),
        patchBot: vi.fn(),
        uploadProfileImage: vi.fn(),
        setDefaultProfileImage: vi.fn(),
        createUserAccessToken: vi.fn(),
        updateUserRoles: vi.fn(),
    };

    it('blank', () => {
        const {container} = renderWithContext(
            <AddBot
                maxFileSize={100}
                team={team}
                editingUserHasManageSystem={true}
                actions={actions}
            />,
        );

        const usernameInput = container.querySelector('#username') as HTMLInputElement;
        const displayNameInput = container.querySelector('#displayName') as HTMLInputElement;
        const descriptionInput = container.querySelector('#description') as HTMLInputElement;

        expect(usernameInput.value).toBe('');
        expect(displayNameInput.value).toBe('');
        expect(descriptionInput.value).toBe('');
        expect(container).toMatchSnapshot();
    });

    it('edit bot', () => {
        const bot = TestHelper.getBotMock({});
        const {container} = renderWithContext(
            <AddBot
                bot={bot}
                maxFileSize={100}
                team={team}
                editingUserHasManageSystem={true}
                actions={actions}
            />,
        );

        const usernameInput = container.querySelector('#username') as HTMLInputElement;
        const displayNameInput = container.querySelector('#displayName') as HTMLInputElement;
        const descriptionInput = container.querySelector('#description') as HTMLInputElement;

        expect(usernameInput.value).toBe(bot.username);
        expect(displayNameInput.value).toBe(bot.display_name);
        expect(descriptionInput.value).toBe(bot.description);
    });
});
