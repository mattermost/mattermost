// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import AbstractCommand from 'components/integrations/abstract_command';

import {renderWithContext, screen, userEvent, fireEvent, waitFor} from 'tests/react_testing_utils';
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

    const action = jest.fn().mockImplementation(
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

    test('should match snapshot, displays client error', async () => {
        const newSeverError = 'server error';
        const props = {...baseProps, serverError: newSeverError};
        const {container} = renderWithContext(
            <AbstractCommand {...props}/>,
        );

        const triggerInput = container.querySelector('#trigger') as HTMLInputElement;
        await userEvent.clear(triggerInput);

        await userEvent.click(screen.getByText('Footer'));

        expect(container).toMatchSnapshot();
        expect(action).not.toHaveBeenCalled();
    });

    test('should call action function', async () => {
        const newAction = jest.fn().mockImplementation(
            () => {
                return new Promise<void>((resolve) => {
                    process.nextTick(() => resolve());
                });
            },
        );
        const props = {...baseProps, action: newAction};
        renderWithContext(
            <AbstractCommand {...props}/>,
        );

        const displayNameInput = document.querySelector('#displayName') as HTMLInputElement;
        await userEvent.clear(displayNameInput);
        await userEvent.type(displayNameInput, 'name');

        await userEvent.click(screen.getByText('Footer'));

        expect(newAction).toHaveBeenCalled();
    });

    test('should match object returned by getStateFromCommand', () => {
        const {container} = renderWithContext(
            <AbstractCommand {...baseProps}/>,
        );

        // Verify the form fields are populated correctly from the initial command
        expect((container.querySelector('#displayName') as HTMLInputElement).value).toBe('display_name');
        expect((container.querySelector('#description') as HTMLInputElement).value).toBe('description');
        expect((container.querySelector('#trigger') as HTMLInputElement).value).toBe('trigger');
        expect((container.querySelector('#url') as HTMLInputElement).value).toBe('https://google.com/command');
        expect((container.querySelector('#method') as HTMLSelectElement).value).toBe('G');
        expect((container.querySelector('#username') as HTMLInputElement).value).toBe('username');
        expect((container.querySelector('#iconUrl') as HTMLInputElement).value).toBe('https://google.com/icon');
        expect((container.querySelector('#autocomplete') as HTMLInputElement).checked).toBe(true);
        expect((container.querySelector('#autocompleteHint') as HTMLInputElement).value).toBe('auto_complete_hint');
    });

    test('should match state when method is called', async () => {
        const {container} = renderWithContext(
            <AbstractCommand {...baseProps}/>,
        );

        const displayNameInput = container.querySelector('#displayName') as HTMLInputElement;
        await userEvent.clear(displayNameInput);
        await userEvent.type(displayNameInput, 'new display_name');
        expect(displayNameInput.value).toBe('new display_name');

        const descriptionInput = container.querySelector('#description') as HTMLInputElement;
        await userEvent.clear(descriptionInput);
        await userEvent.type(descriptionInput, 'new description');
        expect(descriptionInput.value).toBe('new description');

        const triggerInput = container.querySelector('#trigger') as HTMLInputElement;
        await userEvent.clear(triggerInput);
        await userEvent.type(triggerInput, 'new trigger');
        expect(triggerInput.value).toBe('new trigger');

        const urlInput = container.querySelector('#url') as HTMLInputElement;
        await userEvent.clear(urlInput);
        await userEvent.type(urlInput, 'new url');
        expect(urlInput.value).toBe('new url');

        const methodSelect = container.querySelector('#method') as HTMLSelectElement;
        await userEvent.selectOptions(methodSelect, 'P');
        expect(methodSelect.value).toBe('P');

        const usernameInput = container.querySelector('#username') as HTMLInputElement;
        await userEvent.clear(usernameInput);
        await userEvent.type(usernameInput, 'new username');
        expect(usernameInput.value).toBe('new username');

        const iconUrlInput = container.querySelector('#iconUrl') as HTMLInputElement;
        await userEvent.clear(iconUrlInput);
        await userEvent.type(iconUrlInput, 'new iconUrl');
        expect(iconUrlInput.value).toBe('new iconUrl');

        const autocompleteCheckbox = container.querySelector('#autocomplete') as HTMLInputElement;

        // autocomplete is initially true, uncheck it
        await userEvent.click(autocompleteCheckbox);
        expect(autocompleteCheckbox.checked).toBe(false);

        // check it again
        await userEvent.click(autocompleteCheckbox);
        expect(autocompleteCheckbox.checked).toBe(true);

        const autocompleteHintInput = container.querySelector('#autocompleteHint') as HTMLInputElement;
        await userEvent.clear(autocompleteHintInput);
        await userEvent.type(autocompleteHintInput, 'new autocompleteHint');
        expect(autocompleteHintInput.value).toBe('new autocompleteHint');
    });

    test('should match state when handleSubmit is called', async () => {
        const newAction = jest.fn().mockImplementation(
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

        const triggerInput = container.querySelector('#trigger') as HTMLInputElement;
        const urlInput = container.querySelector('#url') as HTMLInputElement;
        const submitButton = screen.getByText('Footer');

        expect(newAction).toHaveBeenCalledTimes(0);

        // valid submit
        await userEvent.click(submitButton);
        await waitFor(() => {
            expect(newAction).toHaveBeenCalledTimes(1);
        });

        // empty trigger
        await userEvent.clear(triggerInput);
        await userEvent.click(submitButton);
        expect(screen.getByText('A trigger word is required')).toBeInTheDocument();
        expect(newAction).toHaveBeenCalledTimes(1);

        // trigger that starts with a slash '/' (after trim/lowercase, leading slash is stripped, leaving '/startwithslash' which starts with /)
        await userEvent.clear(triggerInput);
        await userEvent.type(triggerInput, '//startwithslash');
        await userEvent.click(submitButton);
        expect(screen.getByText('A trigger word cannot begin with a /')).toBeInTheDocument();
        expect(newAction).toHaveBeenCalledTimes(1);

        // trigger with space
        await userEvent.clear(triggerInput);
        await userEvent.type(triggerInput, '/trigger with space');
        await userEvent.click(submitButton);
        expect(screen.getByText('A trigger word must not contain spaces')).toBeInTheDocument();
        expect(newAction).toHaveBeenCalledTimes(1);

        // trigger above maximum length - use fireEvent.change to bypass maxLength constraint
        fireEvent.change(triggerInput, {target: {value: '123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789'}});
        await userEvent.click(submitButton);
        expect(screen.getByText(/A trigger word must contain between/)).toBeInTheDocument();
        expect(newAction).toHaveBeenCalledTimes(1);

        // good triggers - 128 chars
        fireEvent.change(triggerInput, {target: {value: '12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678'}});
        await userEvent.click(submitButton);
        await waitFor(() => {
            expect(newAction).toHaveBeenCalledTimes(2);
        });

        // good trigger with leading slash
        await userEvent.clear(triggerInput);
        await userEvent.type(triggerInput, '/trigger');
        await userEvent.click(submitButton);
        await waitFor(() => {
            expect(newAction).toHaveBeenCalledTimes(3);
        });

        // good trigger without slash
        await userEvent.clear(triggerInput);
        await userEvent.type(triggerInput, 'trigger');
        await userEvent.click(submitButton);
        await waitFor(() => {
            expect(newAction).toHaveBeenCalledTimes(4);
        });

        // empty url
        await userEvent.clear(urlInput);
        await userEvent.clear(triggerInput);
        await userEvent.type(triggerInput, 'trigger');
        await userEvent.click(submitButton);
        expect(screen.getByText('A request URL is required')).toBeInTheDocument();
        expect(newAction).toHaveBeenCalledTimes(4);
    });
});
