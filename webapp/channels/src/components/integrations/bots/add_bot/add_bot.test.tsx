// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {takePendingBotToken} from 'components/integrations/bots/bot_pending_token';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';
import {TestHelper} from 'utils/test_helper';

import AddBot from './add_bot';

describe('components/integrations/bots/AddBot', () => {
    const team = TestHelper.getTeamMock();

    const actions = {
        createBot: jest.fn(),
        patchBot: jest.fn(),
        uploadProfileImage: jest.fn(),
        setDefaultProfileImage: jest.fn(),
        createUserAccessToken: jest.fn(),
        updateUserRoles: jest.fn(),
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

        expect(usernameInput).toBeInTheDocument();
        expect(usernameInput.value).toBe('');
        expect(displayNameInput).toBeInTheDocument();
        expect(displayNameInput.value).toBe('');
        expect(descriptionInput).toBeInTheDocument();
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

        expect(usernameInput).toBeInTheDocument();
        expect(usernameInput.value).toBe(bot.username);
        expect(displayNameInput).toBeInTheDocument();
        expect(displayNameInput.value).toBe(bot.display_name);
        expect(descriptionInput).toBeInTheDocument();
        expect(descriptionInput.value).toBe(bot.description);
    });

    it('create bot hands the token over in memory instead of the URL', async () => {
        const token = 'jb6oyqh95irpbx8fo9zmndkp1r';
        const userId = 'b5tpgt4iepf45jt768jz84djhd';
        const push = getHistory().push as jest.Mock;
        const createActions = {
            ...actions,
            createBot: jest.fn().mockResolvedValue({data: {user_id: userId}}),
            setDefaultProfileImage: jest.fn().mockResolvedValue({}),
            createUserAccessToken: jest.fn().mockResolvedValue({data: {token}}),
        };

        const {container} = renderWithContext(
            <AddBot
                maxFileSize={100}
                team={team}
                editingUserHasManageSystem={true}
                actions={createActions}
            />,
        );

        await userEvent.type(container.querySelector('#username') as HTMLInputElement, 'newbot');
        await userEvent.click(screen.getByRole('button', {name: 'Create Bot Account'}));

        await waitFor(() => expect(push).toHaveBeenCalled());
        const url = String(push.mock.calls[0][0]);
        expect(url).toBe(`/${team.name}/integrations/confirm?type=bots&id=${userId}`);
        expect(url).not.toContain(token);
        expect(takePendingBotToken(userId)).toBe(token);
    });
});
