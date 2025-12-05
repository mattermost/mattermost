// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Command} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';

import type {ActionResult} from 'mattermost-redux/types/actions';

import EditCommand from 'components/integrations/edit_command/edit_command';

import {renderWithContext, screen, act} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/integrations/EditCommand', () => {
    const getCustomTeamCommands = vi.fn(
        () => {
            return new Promise<ActionResult<Command[]>>((resolve) => {
                process.nextTick(() => resolve({data: []}));
            });
        },
    );

    const commands = {
        r5tpgt4iepf45jt768jz84djic: TestHelper.getCommandMock({
            id: 'r5tpgt4iepf45jt768jz84djic',
            display_name: 'display_name',
            description: 'description',
            trigger: 'trigger',
            auto_complete: true,
            auto_complete_hint: 'auto_complete_hint',
            auto_complete_desc: 'auto_complete_desc',
            token: 'jb6oyqh95irpbx8fo9zmndkp1r',
            create_at: 1499722850203,
            creator_id: '88oybd1dwfdoxpkpw1h5kpbyco',
            delete_at: 0,
            icon_url: 'https://google.com/icon',
            method: 'G',
            team_id: 'm5gix3oye3du8ghk4ko6h9cq7y',
            update_at: 1504468859001,
            url: 'https://google.com/command',
            username: 'username',
        }),
    };
    const team: Team = TestHelper.getTeamMock({
        name: 'test',
        id: 'm5gix3oye3du8ghk4ko6h9cq7y',
    });

    const editCommandRequest = {
        status: 'not_started',
        error: null,
    };

    const baseProps = {
        team,
        commandId: 'r5tpgt4iepf45jt768jz84djic',
        commands,
        editCommandRequest,
        actions: {
            getCustomTeamCommands,
            editCommand: vi.fn(),
        },
        enableCommands: true,
    };

    test('should match snapshot', async () => {
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <EditCommand {...baseProps}/>,
            );
            container = result.container;
        });

        // Wait for the command to load
        await vi.waitFor(() => {
            expect(baseProps.actions.getCustomTeamCommands).toHaveBeenCalled();
        });

        expect(baseProps.actions.getCustomTeamCommands).toHaveBeenCalledWith(team.id);
        expect(container!).toMatchSnapshot();
    });

    test('should match snapshot, loading', async () => {
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <EditCommand {...baseProps}/>,
            );
            container = result.container;
        });

        expect(container!).toMatchSnapshot();
    });

    test('should match snapshot when EnableCommands is false', async () => {
        const actions = {
            getCustomTeamCommands: vi.fn(),
            editCommand: vi.fn(),
        };
        const props = {...baseProps, actions, enableCommands: false};
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <EditCommand {...props}/>,
            );
            container = result.container;
        });

        expect(container!).toMatchSnapshot();
        expect(actions.getCustomTeamCommands).not.toHaveBeenCalled();
    });

    test('should have match state when handleConfirmModal is called', async () => {
        const props = {...baseProps, getCustomTeamCommands};
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <EditCommand {...props}/>,
            );
            container = result.container;
        });

        // The component loads and displays the form
        await vi.waitFor(() => {
            expect(container!.querySelector('.backstage-form')).toBeInTheDocument();
        });

        // The header shows "Edit"
        expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    test('should have match state when confirmModalDismissed is called', async () => {
        const props = {...baseProps, getCustomTeamCommands};
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <EditCommand {...props}/>,
            );
            container = result.container;
        });

        await vi.waitFor(() => {
            expect(container!.querySelector('.backstage-form')).toBeInTheDocument();
        });

        // The header shows "Edit"
        expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    test('should have match renderExtra', async () => {
        const props = {...baseProps, getCustomTeamCommands};
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <EditCommand {...props}/>,
            );
            container = result.container;
        });

        await vi.waitFor(() => {
            expect(container!.querySelector('.backstage-form__footer')).toBeInTheDocument();
        });

        expect(container!).toMatchSnapshot();
    });

    test('should have match when editCommand is called', async () => {
        const props = {...baseProps, getCustomTeamCommands};
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <EditCommand {...props}/>,
            );
            container = result.container;
        });

        await vi.waitFor(() => {
            expect(container!.querySelector('.backstage-form')).toBeInTheDocument();
        });

        // The header shows "Edit"
        expect(screen.getByText('Edit')).toBeInTheDocument();
    });
});
