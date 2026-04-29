// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import React from 'react';

import type {OutgoingWebhook} from '@mattermost/types/integrations';

import InstalledOutgoingWebhooks from 'components/integrations/installed_outgoing_webhooks/installed_outgoing_webhooks';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

jest.mock('components/integrations/delete_integration_link', () => {
    const ReactMock = require('react'); // eslint-disable-line @typescript-eslint/no-var-requires, global-require
    return {
        __esModule: true,
        default: (props: {onDelete: () => void}) => ReactMock.createElement('button', {onClick: props.onDelete}, 'Delete'),
    };
});

describe('components/integrations/InstalledOutgoingWebhooks', () => {
    const teamId = 'testteamid';
    const team = TestHelper.getTeamMock({
        id: teamId,
        name: 'test',
    });
    const user = TestHelper.getUserMock({
        first_name: 'sudheer',
        id: 'zaktnt8bpbgu8mb6ez9k64r7sa',
        roles: 'system_admin system_user',
        username: 'sudheerdev',
    });
    const channel = TestHelper.getChannelMock({
        id: 'mdpzfpfcxi85zkkqkzkch4b85h',
        name: 'town-square',
        display_name: 'town-square',
    });
    const outgoingWebhooks = [
        {
            callback_urls: ['http://adsfdasd.com'],
            channel_id: 'mdpzfpfcxi85zkkqkzkch4b85h',
            content_type: 'application/x-www-form-urlencoded',
            create_at: 1508327769020,
            creator_id: 'zaktnt8bpbgu8mb6ez9k64r7sa',
            delete_at: 0,
            description: 'build status',
            display_name: '',
            id: '7h88x419ubbyuxzs7dfwtgkfgr',
            team_id: 'eatxocwc3bg9ffo9xyybnj4omr',
            token: 'xoxz1z7c3tgi9xhrfudn638q9r',
            trigger_when: 0,
            trigger_words: ['build'],
            0: 'asdf',
            update_at: 1508329149618,
        } as unknown as OutgoingWebhook,
        {
            callback_urls: ['http://adsfdasd.com'],
            channel_id: 'mdpzfpfcxi85zkkqkzkch4b85h',
            content_type: 'application/x-www-form-urlencoded',
            create_at: 1508327769020,
            creator_id: 'zaktnt8bpbgu8mb6ez9k64r7sa',
            delete_at: 0,
            description: 'test',
            display_name: '',
            id: '7h88x419ubbyuxzs7dfwtgkffr',
            team_id: 'eatxocwc3bg9ffo9xyybnj4omr',
            token: 'xoxz1z7c3tgi9xhrfudn638q9r',
            trigger_when: 0,
            trigger_words: ['test'],
            0: 'asdf',
            update_at: 1508329149618,
        } as unknown as OutgoingWebhook,
    ];

    const initialState = {
        entities: {
            general: {
                config: {},
            },
            users: {
                currentUserId: 'currentUserId',
            },
        },
    };

    const defaultProps = {
        outgoingWebhooks,
        teamId,
        team,
        user,
        users: {zaktnt8bpbgu8mb6ez9k64r7sa: user},
        channels: {mdpzfpfcxi85zkkqkzkch4b85h: channel},
        actions: {
            removeOutgoingHook: jest.fn(),
            loadOutgoingHooksAndProfilesForTeam: jest.fn().mockReturnValue(Promise.resolve()),
            regenOutgoingHookToken: jest.fn(),
        },
        enableOutgoingWebhooks: true,
        canManageOthersWebhooks: true,
    };

    test('should match snapshot', async () => {
        const {container} = renderWithContext(
            <InstalledOutgoingWebhooks
                {...defaultProps}
            />,
            initialState,
        );

        await waitFor(() => {
            expect(screen.getByText('build status')).toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });

    test('should call regenOutgoingHookToken function', async () => {
        const regenOutgoingHookToken = jest.fn();
        const props = {
            ...defaultProps,
            actions: {
                ...defaultProps.actions,
                regenOutgoingHookToken,
            },
        };

        renderWithContext(
            <InstalledOutgoingWebhooks
                {...props}
            />,
            initialState,
        );

        await waitFor(() => {
            expect(screen.getAllByRole('button', {name: 'Regenerate Token'})).toHaveLength(2);
        });

        await userEvent.click(screen.getAllByRole('button', {name: 'Regenerate Token'})[0]);
        expect(regenOutgoingHookToken).toHaveBeenCalledTimes(1);
        expect(regenOutgoingHookToken).toHaveBeenCalledWith(outgoingWebhooks[0].id);
    });

    test('should call removeOutgoingHook function', async () => {
        const removeOutgoingHook = jest.fn();
        const props = {
            ...defaultProps,
            actions: {
                ...defaultProps.actions,
                removeOutgoingHook,
            },
        };

        renderWithContext(
            <InstalledOutgoingWebhooks
                {...props}
            />,
            initialState,
        );

        await waitFor(() => {
            expect(screen.getAllByRole('button', {name: 'Delete'})).toHaveLength(2);
        });

        await userEvent.click(screen.getAllByRole('button', {name: 'Delete'})[1]);
        expect(removeOutgoingHook).toHaveBeenCalledTimes(1);
        expect(removeOutgoingHook).toHaveBeenCalledWith(outgoingWebhooks[1].id);
    });
});
