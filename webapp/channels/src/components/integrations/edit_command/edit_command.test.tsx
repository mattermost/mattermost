// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Command} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';

import type {ActionResult} from 'mattermost-redux/types/actions';

import EditCommand from 'components/integrations/edit_command/edit_command';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/integrations/EditCommand', () => {
    const getCustomTeamCommands = jest.fn(
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
            editCommand: jest.fn(),
        },
        enableCommands: true,
    };

    test('should match snapshot', async () => {
        const {container} = renderWithContext(
            <EditCommand {...baseProps}/>,
        );

        // Wait for getCustomTeamCommands to resolve and command form to render
        await waitFor(() => {
            expect(container.querySelector('#displayName')).toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();

        expect(baseProps.actions.getCustomTeamCommands).toHaveBeenCalled();
        expect(baseProps.actions.getCustomTeamCommands).toHaveBeenCalledWith(team.id);
    });

    test('should match snapshot, loading', () => {
        const {container} = renderWithContext(
            <EditCommand {...baseProps}/>,
        );

        // Before getCustomTeamCommands resolves, should show loading
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when EnableCommands is false', () => {
        const actions = {
            getCustomTeamCommands: jest.fn(),
            editCommand: jest.fn(),
        };
        const props = {...baseProps, actions, enableCommands: false};
        const {container} = renderWithContext(
            <EditCommand {...props}/>,
        );

        expect(container).toMatchSnapshot();
        expect(actions.getCustomTeamCommands).not.toHaveBeenCalled();
    });

    test('should have match state when handleConfirmModal is called', async () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                getCustomTeamCommands: jest.fn().mockResolvedValue({data: []}),
                editCommand: jest.fn(),
            },
        };
        const {container} = renderWithContext(
            <EditCommand {...props}/>,
        );

        // Wait for the form to render after commands are loaded
        await waitFor(() => {
            expect(container.querySelector('#displayName')).toBeInTheDocument();
        });

        // Change URL to trigger confirm modal on submit
        const urlInput = container.querySelector('#url') as HTMLInputElement;
        const originalUrl = urlInput.value;
        expect(originalUrl).toBe('https://google.com/command');

        // Change URL to a different value to trigger confirm modal
        const {userEvent} = await import('tests/react_testing_utils');
        await userEvent.clear(urlInput);
        await userEvent.type(urlInput, 'https://different-url.com/command');

        // Submit to trigger handleConfirmModal
        await userEvent.click(screen.getByText('Update'));

        // The confirm modal should be shown
        await waitFor(() => {
            expect(screen.getByText('Edit Slash Command')).toBeInTheDocument();
        });
    });

    test('should have match state when confirmModalDismissed is called', async () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                getCustomTeamCommands: jest.fn().mockResolvedValue({data: []}),
                editCommand: jest.fn(),
            },
        };
        const {container} = renderWithContext(
            <EditCommand {...props}/>,
        );

        // Wait for the form to render
        await waitFor(() => {
            expect(container.querySelector('#displayName')).toBeInTheDocument();
        });

        // Change URL to trigger confirm modal
        const urlInput = container.querySelector('#url') as HTMLInputElement;
        const {userEvent} = await import('tests/react_testing_utils');
        await userEvent.clear(urlInput);
        await userEvent.type(urlInput, 'https://different-url.com/command');

        // Submit to trigger confirm modal
        await userEvent.click(screen.getByText('Update'));

        // The confirm modal should be shown
        await waitFor(() => {
            expect(screen.getByText('Edit Slash Command')).toBeInTheDocument();
        });

        // Dismiss the modal by clicking Cancel on the confirm modal
        await userEvent.click(screen.getByTestId('cancel-button'));

        // The confirm modal should be dismissed
        await waitFor(() => {
            expect(screen.queryByText('Your changes may break the existing slash command. Are you sure you would like to update it?')).not.toBeInTheDocument();
        });
    });

    test('should have match renderExtra', async () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                getCustomTeamCommands: jest.fn().mockResolvedValue({data: []}),
                editCommand: jest.fn(),
            },
        };
        const {container} = renderWithContext(
            <EditCommand {...props}/>,
        );

        // Wait for the form to render
        await waitFor(() => {
            expect(container.querySelector('#displayName')).toBeInTheDocument();
        });

        // The ConfirmModal (renderExtra) should be rendered but not visible initially
        // The modal has show=false, so it renders but is hidden
        expect(container).toMatchSnapshot();
    });

    test('should have match when editCommand is called', async () => {
        const editCommand = jest.fn().mockResolvedValue({data: true});
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                getCustomTeamCommands: jest.fn().mockResolvedValue({data: []}),
                editCommand,
            },
        };
        const {container} = renderWithContext(
            <EditCommand {...props}/>,
        );

        // Wait for the form to render
        await waitFor(() => {
            expect(container.querySelector('#displayName')).toBeInTheDocument();
        });

        // Submit without changing url, trigger, or method - should call submitCommand directly, not show confirm modal
        const {userEvent} = await import('tests/react_testing_utils');
        await userEvent.click(screen.getByText('Update'));

        // Since URL, trigger, and method are unchanged, submitCommand should be called directly
        await waitFor(() => {
            expect(editCommand).toHaveBeenCalled();
        });

        // Confirm modal should NOT have been shown
        expect(screen.queryByText('Edit Slash Command')).not.toBeInTheDocument();
    });
});
