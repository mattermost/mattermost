// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import type {OutgoingWebhook} from '@mattermost/types/integrations';

import InstalledOutgoingWebhooks from 'components/integrations/installed_outgoing_webhooks/installed_outgoing_webhooks';

import {renderWithContext, act} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

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

    const defaultProps: ComponentProps<typeof InstalledOutgoingWebhooks> = {
        outgoingWebhooks,
        teamId,
        team,
        user,
        users: {zaktnt8bpbgu8mb6ez9k64r7sa: user},
        channels: {mdpzfpfcxi85zkkqkzkch4b85h: channel},
        actions: {
            removeOutgoingHook: vi.fn(),
            loadOutgoingHooksAndProfilesForTeam: vi.fn().mockReturnValue(Promise.resolve()),
            regenOutgoingHookToken: vi.fn(),
        },
        enableOutgoingWebhooks: true,
        canManageOthersWebhooks: true,
    };

    test('should match snapshot', async () => {
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <InstalledOutgoingWebhooks {...defaultProps}/>,
            );
            container = result.container;
        });

        await vi.waitFor(() => {
            expect(defaultProps.actions.loadOutgoingHooksAndProfilesForTeam).toHaveBeenCalled();
        });

        expect(container!).toMatchSnapshot();
    });

    test('should call regenOutgoingHookToken function', async () => {
        const regenOutgoingHookToken = vi.fn();
        const props = {
            ...defaultProps,
            actions: {
                ...defaultProps.actions,
                regenOutgoingHookToken,
            },
        };

        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <InstalledOutgoingWebhooks {...props}/>,
            );
            container = result.container;
        });

        await vi.waitFor(() => {
            expect(container!.querySelector('.item-details')).toBeInTheDocument();
        });

        // The component renders webhooks that have regen token buttons
        expect(container!).toMatchSnapshot();
    });

    test('should call removeOutgoingHook function', async () => {
        const removeOutgoingHook = vi.fn();
        const props = {
            ...defaultProps,
            actions: {
                ...defaultProps.actions,
                removeOutgoingHook,
            },
        };

        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <InstalledOutgoingWebhooks {...props}/>,
            );
            container = result.container;
        });

        await vi.waitFor(() => {
            expect(container!.querySelector('.item-details')).toBeInTheDocument();
        });

        expect(container!).toMatchSnapshot();
    });
});
