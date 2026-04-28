// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import AbstractOAuthApp from 'components/integrations/abstract_oauth_app';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

jest.mock('components/permissions_gates/system_permission_gate', () => ({children}: {children: React.ReactNode}) => <>{children}</>);

describe('components/integrations/AbstractOAuthApp', () => {
    const header = {id: 'Header', defaultMessage: 'Header'};
    const footer = {id: 'Footer', defaultMessage: 'Footer'};
    const loading = {id: 'Loading', defaultMessage: 'Loading'};
    const initialApp = {
        id: 'facxd9wpzpbpfp8pad78xj75pr',
        name: 'testApp',
        client_secret: '88cxd9wpzpbpfp8pad78xj75pr',
        create_at: 1501365458934,
        creator_id: '88oybd1dwfdoxpkpw1h5kpbyco',
        description: 'testing',
        homepage: 'https://test.com',
        icon_url: 'https://test.com/icon',
        is_trusted: true,
        update_at: 1501365458934,
        callback_urls: ['https://test.com/callback', 'https://test.com/callback2'],
    };

    const action = jest.fn().mockImplementation(
        () => {
            return new Promise<void>((resolve) => {
                process.nextTick(() => resolve());
            });
        },
    );

    const team = TestHelper.getTeamMock({name: 'test', id: initialApp.id});

    beforeEach(() => {
        action.mockClear();
    });

    const baseProps = {
        team,
        header,
        footer,
        loading,
        renderExtra: <div>{'renderExtra'}</div>,
        serverError: '',
        initialApp,
        action: jest.fn(),
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <AbstractOAuthApp {...baseProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, displays client error', async () => {
        const newServerError = 'serverError';
        const props = {...baseProps, serverError: newServerError};
        const {container} = renderWithContext(
            <AbstractOAuthApp {...props}/>,
        );

        const callbackUrlsInput = screen.getByRole('textbox', {name: 'Callback URLs (One Per Line)'});
        await userEvent.clear(callbackUrlsInput);

        const submitButton = screen.getByRole('button', {name: 'Footer'});
        await userEvent.click(submitButton);

        expect(props.action).not.toHaveBeenCalled();
        expect(container).toMatchSnapshot();
    });

    test('should call action function', async () => {
        const props = {...baseProps, action};
        renderWithContext(
            <AbstractOAuthApp {...props}/>,
        );

        const nameInput = screen.getByRole('textbox', {name: 'Display Name'});
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'name');

        const submitButton = screen.getByRole('button', {name: 'Footer'});
        await userEvent.click(submitButton);

        expect(action).toHaveBeenCalled();
    });

    test('should have correct state when updateName is called', async () => {
        const props = {...baseProps, action};
        renderWithContext(
            <AbstractOAuthApp {...props}/>,
        );

        const nameInput = screen.getByRole('textbox', {name: 'Display Name'});
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'new name');
        expect(nameInput).toHaveValue('new name');

        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'another name');
        expect(nameInput).toHaveValue('another name');
    });

    test('should have correct state when updateTrusted is called', async () => {
        const props = {...baseProps, action};
        const {container} = renderWithContext(
            <AbstractOAuthApp {...props}/>,
        );

        // Use name attribute to target is_trusted radio buttons specifically
        const trustedNoRadio = container.querySelector('input[name="is_trusted"][value="false"]') as HTMLInputElement;
        const trustedYesRadio = container.querySelector('input[name="is_trusted"][value="true"]') as HTMLInputElement;

        await userEvent.click(trustedNoRadio);
        expect(trustedNoRadio).toBeChecked();

        await userEvent.click(trustedYesRadio);
        expect(trustedYesRadio).toBeChecked();
    });

    test('should have correct state when updateDescription is called', async () => {
        const props = {...baseProps, action};
        renderWithContext(
            <AbstractOAuthApp {...props}/>,
        );

        const descriptionInput = screen.getByRole('textbox', {name: 'Description'});
        await userEvent.clear(descriptionInput);
        await userEvent.type(descriptionInput, 'new description');
        expect(descriptionInput).toHaveValue('new description');

        await userEvent.clear(descriptionInput);
        await userEvent.type(descriptionInput, 'another description');
        expect(descriptionInput).toHaveValue('another description');
    });

    test('should have correct state when updateHomepage is called', async () => {
        const props = {...baseProps, action};
        renderWithContext(
            <AbstractOAuthApp {...props}/>,
        );

        const homepageInput = screen.getByRole('textbox', {name: 'Homepage'});
        await userEvent.clear(homepageInput);
        await userEvent.type(homepageInput, 'new homepage');
        expect(homepageInput).toHaveValue('new homepage');

        await userEvent.clear(homepageInput);
        await userEvent.type(homepageInput, 'another homepage');
        expect(homepageInput).toHaveValue('another homepage');
    });

    test('should have correct state when updateIconUrl is called', async () => {
        const props = {...baseProps, action};
        renderWithContext(
            <AbstractOAuthApp {...props}/>,
        );

        const iconUrlInput = screen.getByRole('textbox', {name: 'Icon URL'});
        await userEvent.clear(iconUrlInput);
        await userEvent.type(iconUrlInput, 'https://test.com/new_icon_url');
        expect(iconUrlInput).toHaveValue('https://test.com/new_icon_url');

        await userEvent.clear(iconUrlInput);
        await userEvent.type(iconUrlInput, 'https://test.com/another_icon_url');
        expect(iconUrlInput).toHaveValue('https://test.com/another_icon_url');
    });

    test('should have correct state when handleSubmit is called', async () => {
        const props = {...baseProps, action};
        renderWithContext(
            <AbstractOAuthApp {...props}/>,
        );

        const nameInput = screen.getByRole('textbox', {name: 'Display Name'});
        const descriptionInput = screen.getByRole('textbox', {name: 'Description'});
        const homepageInput = screen.getByRole('textbox', {name: 'Homepage'});
        const submitButton = screen.getByRole('button', {name: 'Footer'});

        // Clear name to trigger name required error
        await userEvent.clear(nameInput);
        await userEvent.click(submitButton);
        expect(screen.getByText('Name for the OAuth 2.0 application is required.')).toBeInTheDocument();

        // Set name, clear description to trigger description required error
        await userEvent.type(nameInput, 'name');
        await userEvent.clear(descriptionInput);
        await userEvent.click(submitButton);
        expect(screen.getByText('Description for the OAuth 2.0 application is required.')).toBeInTheDocument();

        // Set description, clear homepage to trigger homepage required error
        await userEvent.type(descriptionInput, 'description');
        await userEvent.clear(homepageInput);
        await userEvent.click(submitButton);
        expect(screen.getByText('Homepage for the OAuth 2.0 application is required.')).toBeInTheDocument();
    });

    test('should not require description and homepage for dynamically registered apps', async () => {
        const dynamicApp = {
            ...initialApp,
            is_dynamically_registered: true,
        };
        const props = {...baseProps, action, initialApp: dynamicApp};
        renderWithContext(
            <AbstractOAuthApp {...props}/>,
        );

        const nameInput = screen.getByRole('textbox', {name: 'Display Name'});
        const descriptionInput = screen.getByRole('textbox', {name: 'Description'});
        const homepageInput = screen.getByRole('textbox', {name: 'Homepage'});
        const submitButton = screen.getByRole('button', {name: 'Footer'});

        // Set name, clear description and homepage
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'name');
        await userEvent.clear(descriptionInput);
        await userEvent.clear(homepageInput);

        await userEvent.click(submitButton);

        await waitFor(() => {
            expect(action).toHaveBeenCalledTimes(1);
        });
    });

    test('should still require description and homepage for regular OAuth apps', async () => {
        const regularApp = {
            ...initialApp,
            is_dynamically_registered: false,
        };
        const props = {...baseProps, action, initialApp: regularApp};
        renderWithContext(
            <AbstractOAuthApp {...props}/>,
        );

        const nameInput = screen.getByRole('textbox', {name: 'Display Name'});
        const descriptionInput = screen.getByRole('textbox', {name: 'Description'});
        const homepageInput = screen.getByRole('textbox', {name: 'Homepage'});
        const submitButton = screen.getByRole('button', {name: 'Footer'});

        // Set name, clear description
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'name');
        await userEvent.clear(descriptionInput);
        await userEvent.click(submitButton);
        expect(screen.getByText('Description for the OAuth 2.0 application is required.')).toBeInTheDocument();

        // Set description, clear homepage
        await userEvent.type(descriptionInput, 'test');
        await userEvent.clear(homepageInput);
        await userEvent.click(submitButton);
        expect(screen.getByText('Homepage for the OAuth 2.0 application is required.')).toBeInTheDocument();
    });
});
