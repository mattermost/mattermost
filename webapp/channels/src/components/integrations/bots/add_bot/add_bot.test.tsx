// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fireEvent, renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';
import {TestHelper} from 'utils/test_helper';

import AddBot from './add_bot';

describe('components/integrations/bots/AddBot', () => {
    const team = TestHelper.getTeamMock();
    const FROZEN_NOW = new Date(2026, 5, 15, 12, 0, 0).getTime();
    const DAY_MS = 24 * 60 * 60 * 1000;

    const actions = {
        createBot: jest.fn(),
        patchBot: jest.fn(),
        uploadProfileImage: jest.fn(),
        setDefaultProfileImage: jest.fn(),
        createUserAccessToken: jest.fn(),
        updateUserRoles: jest.fn(),
    };

    beforeAll(() => {
        jest.useFakeTimers().setSystemTime(FROZEN_NOW);
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('blank', () => {
        const {container} = renderWithContext(
            <AddBot
                maxFileSize={100}
                maxLifetimeDays={0}
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
                maxLifetimeDays={0}
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

    it('creates the default token without expiry when no maximum lifetime is configured', async () => {
        const bot = TestHelper.getBotMock({user_id: 'bot-user-id', username: 'testbot'});
        const createBot = jest.fn().mockResolvedValue({data: bot});
        const createUserAccessToken = jest.fn().mockResolvedValue({data: TestHelper.getUserAccessTokenMock({token: 'default-secret'})});

        renderWithContext(
            <AddBot
                maxFileSize={100}
                maxLifetimeDays={0}
                team={team}
                editingUserHasManageSystem={true}
                actions={{...actions, createBot, createUserAccessToken}}
            />,
        );

        fireEvent.change(screen.getByLabelText('Username'), {target: {value: 'testbot'}});
        expect(screen.getByText('No expiry')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Create Bot Account'));

        await waitFor(() => expect(createUserAccessToken).toHaveBeenCalledWith(bot.user_id, 'Default Token', undefined));
        expect(getHistory().push).toHaveBeenCalledWith(`/${team.name}/integrations/confirm?type=bots&id=${bot.user_id}&token=default-secret`);
    });

    it('creates the default token with clamped expiry when a maximum lifetime is configured', async () => {
        const bot = TestHelper.getBotMock({user_id: 'bot-user-id', username: 'testbot'});
        const createBot = jest.fn().mockResolvedValue({data: bot});
        const createUserAccessToken = jest.fn().mockResolvedValue({data: TestHelper.getUserAccessTokenMock({token: 'default-secret'})});

        renderWithContext(
            <AddBot
                maxFileSize={100}
                maxLifetimeDays={30}
                team={team}
                editingUserHasManageSystem={true}
                actions={{...actions, createBot, createUserAccessToken}}
            />,
        );

        fireEvent.change(screen.getByLabelText('Username'), {target: {value: 'testbot'}});
        expect(screen.queryByText('No expiry')).not.toBeInTheDocument();
        expect(screen.getByText('Tokens can be valid for up to 30 days.')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Create Bot Account'));

        await waitFor(() => expect(createUserAccessToken).toHaveBeenCalledWith(bot.user_id, 'Default Token', expect.any(Number)));
        const expiresAt = createUserAccessToken.mock.calls[0][2];
        expect(expiresAt).toBeGreaterThan(FROZEN_NOW + (29 * DAY_MS));
        expect(expiresAt).toBeLessThanOrEqual(FROZEN_NOW + (30 * DAY_MS) + 1000);
    });
});
