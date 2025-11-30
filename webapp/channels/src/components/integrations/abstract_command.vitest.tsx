// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import AbstractCommand from 'components/integrations/abstract_command';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/integrations/AbstractCommand', () => {
    const header = {id: 'Header', defaultMessage: 'Header'};
    const footer = {id: 'Footer', defaultMessage: 'Footer'};
    const loading = {id: 'Loading', defaultMessage: 'Loading'};
    const method: 'G' | 'P' | '' = 'G';
    const command = {
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
        method,
        team_id: 'm5gix3oye3du8ghk4ko6h9cq7y',
        update_at: 1504468859001,
        url: 'https://google.com/command',
        username: 'username',
    };
    const team = TestHelper.getTeamMock({name: 'test', id: command.team_id});

    const action = vi.fn().mockImplementation(
        () => {
            return new Promise<void>((resolve) => {
                process.nextTick(() => resolve());
            });
        },
    );

    const baseProps = {
        team,
        header,
        footer,
        loading,
        renderExtra: <div>{'renderExtra'}</div>,
        serverError: '',
        initialCommand: command,
        action,
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <AbstractCommand {...baseProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when header/footer/loading is a string', () => {
        const {container} = renderWithContext(
            <AbstractCommand
                {...baseProps}
                header='Header as string'
                loading={'Loading as string'}
                footer={'Footer as string'}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, displays client error', () => {
        const newSeverError = 'server error';
        const props = {...baseProps, serverError: newSeverError};
        const {container} = renderWithContext(
            <AbstractCommand {...props}/>,
        );

        // Clear the trigger field to cause a validation error
        const triggerInput = container.querySelector('#trigger') as HTMLInputElement;
        fireEvent.change(triggerInput, {target: {value: ''}});

        const submitButton = container.querySelector('.btn-primary');
        fireEvent.click(submitButton!);

        expect(container).toMatchSnapshot();
        expect(action).not.toHaveBeenCalled();
    });

    test('should call action function', () => {
        const newAction = vi.fn().mockImplementation(
            () => {
                return new Promise<void>((resolve) => {
                    process.nextTick(() => resolve());
                });
            },
        );
        const props = {...baseProps, action: newAction};
        const {container} = renderWithContext(
            <AbstractCommand {...props}/>,
        );

        const displayNameInput = container.querySelector('#displayName') as HTMLInputElement;
        fireEvent.change(displayNameInput, {target: {value: 'name'}});

        const submitButton = container.querySelector('.btn-primary');
        fireEvent.click(submitButton!);

        expect(newAction).toHaveBeenCalled();
    });

    test('should match object returned by getStateFromCommand', () => {
        const {container} = renderWithContext(
            <AbstractCommand {...baseProps}/>,
        );

        // Verify the form is populated with command values
        const displayNameInput = container.querySelector('#displayName') as HTMLInputElement;
        const descriptionInput = container.querySelector('#description') as HTMLInputElement;
        const triggerInput = container.querySelector('#trigger') as HTMLInputElement;
        const urlInput = container.querySelector('#url') as HTMLInputElement;
        const usernameInput = container.querySelector('#username') as HTMLInputElement;
        const iconUrlInput = container.querySelector('#iconUrl') as HTMLInputElement;

        expect(displayNameInput.value).toBe(command.display_name);
        expect(descriptionInput.value).toBe(command.description);
        expect(triggerInput.value).toBe(command.trigger);
        expect(urlInput.value).toBe(command.url);
        expect(usernameInput.value).toBe(command.username);
        expect(iconUrlInput.value).toBe(command.icon_url);
    });

    test('should match state when method is called', () => {
        const {container} = renderWithContext(
            <AbstractCommand {...baseProps}/>,
        );

        const displayNameInput = container.querySelector('#displayName') as HTMLInputElement;
        fireEvent.change(displayNameInput, {target: {value: 'new display_name'}});
        expect(displayNameInput.value).toEqual('new display_name');

        const descriptionInput = container.querySelector('#description') as HTMLInputElement;
        fireEvent.change(descriptionInput, {target: {value: 'new description'}});
        expect(descriptionInput.value).toEqual('new description');

        const triggerInput = container.querySelector('#trigger') as HTMLInputElement;
        fireEvent.change(triggerInput, {target: {value: 'new trigger'}});
        expect(triggerInput.value).toEqual('new trigger');

        const urlInput = container.querySelector('#url') as HTMLInputElement;
        fireEvent.change(urlInput, {target: {value: 'new url'}});
        expect(urlInput.value).toEqual('new url');

        const usernameInput = container.querySelector('#username') as HTMLInputElement;
        fireEvent.change(usernameInput, {target: {value: 'new username'}});
        expect(usernameInput.value).toEqual('new username');

        const iconUrlInput = container.querySelector('#iconUrl') as HTMLInputElement;
        fireEvent.change(iconUrlInput, {target: {value: 'new iconUrl'}});
        expect(iconUrlInput.value).toEqual('new iconUrl');

        // Verify form fields update correctly
        expect(displayNameInput.value).toEqual('new display_name');
        expect(descriptionInput.value).toEqual('new description');
        expect(triggerInput.value).toEqual('new trigger');
        expect(urlInput.value).toEqual('new url');
        expect(usernameInput.value).toEqual('new username');
        expect(iconUrlInput.value).toEqual('new iconUrl');
    });

    test('should match state when handleSubmit is called', async () => {
        const newAction = vi.fn().mockResolvedValue(undefined);
        const props = {...baseProps, action: newAction};
        const {container} = renderWithContext(
            <AbstractCommand {...props}/>,
        );

        expect(newAction).toHaveBeenCalledTimes(0);

        // empty trigger - should show error
        const triggerInput = container.querySelector('#trigger') as HTMLInputElement;
        fireEvent.change(triggerInput, {target: {value: ''}});

        const submitButton = container.querySelector('.btn-primary');
        fireEvent.click(submitButton!);

        await vi.waitFor(() => {
            expect(screen.getByText('A trigger word is required')).toBeInTheDocument();
        });
        expect(newAction).toHaveBeenCalledTimes(0);

        // trigger that starts with a slash '//'
        fireEvent.change(triggerInput, {target: {value: '//startwithslash'}});
        fireEvent.click(submitButton!);

        await vi.waitFor(() => {
            expect(screen.getByText('A trigger word cannot begin with a /')).toBeInTheDocument();
        });
        expect(newAction).toHaveBeenCalledTimes(0);

        // trigger with space
        fireEvent.change(triggerInput, {target: {value: '/trigger with space'}});
        fireEvent.click(submitButton!);

        await vi.waitFor(() => {
            expect(screen.getByText('A trigger word must not contain spaces')).toBeInTheDocument();
        });
        expect(newAction).toHaveBeenCalledTimes(0);

        // trigger above maximum length (129 characters)
        fireEvent.change(triggerInput, {target: {value: '123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789'}});
        fireEvent.click(submitButton!);

        await vi.waitFor(() => {
            expect(screen.getByText(/A trigger word must contain between/)).toBeInTheDocument();
        });
        expect(newAction).toHaveBeenCalledTimes(0);
    });
});
