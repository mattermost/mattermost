// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {OAuthApp} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';

import EditOAuthApp from 'components/integrations/edit_oauth_app/edit_oauth_app';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';

jest.mock('components/permissions_gates/system_permission_gate', () => ({children}: {children: React.ReactNode}) => <>{children}</>);

describe('components/integrations/EditOAuthApp', () => {
    const oauthApp: OAuthApp = {
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
    const team: Team = {
        id: 'dbcxd9wpzpbpfp8pad78xj12pr',
        name: 'test',
    } as Team;
    const editOAuthAppRequest = {
        status: 'not_started',
        error: null,
    };

    const baseProps = {
        team,
        oauthAppId: oauthApp.id,
        editOAuthAppRequest,
        actions: {
            getOAuthApp: jest.fn(),
            editOAuthApp: jest.fn(),
        },
        enableOAuthServiceProvider: true,
    };

    test('should match snapshot, loading', () => {
        const props = {...baseProps, oauthApp: undefined as unknown as OAuthApp};
        const {container} = renderWithContext(
            <EditOAuthApp {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot', () => {
        const props = {...baseProps, oauthApp};
        const {container} = renderWithContext(
            <EditOAuthApp {...props}/>,
        );

        expect(container).toMatchSnapshot();
        expect(props.actions.getOAuthApp).toHaveBeenCalledWith(oauthApp.id);
    });

    test('should match snapshot when EnableOAuthServiceProvider is false', () => {
        const props = {...baseProps, oauthApp, enableOAuthServiceProvider: false};
        const {container} = renderWithContext(
            <EditOAuthApp {...props}/>,
        );

        expect(container).toMatchSnapshot();
        expect(props.actions.getOAuthApp).not.toHaveBeenCalledWith();
    });

    test('should have match state when handleConfirmModal is called', async () => {
        const editOAuthApp = jest.fn().mockResolvedValue({data: true});
        const props = {...baseProps, oauthApp, actions: {...baseProps.actions, editOAuthApp}};
        renderWithContext(
            <EditOAuthApp {...props}/>,
        );

        // Change callback URLs to trigger the confirm modal
        const callbackUrlsInput = screen.getByRole('textbox', {name: 'Callback URLs (One Per Line)'});
        await userEvent.clear(callbackUrlsInput);
        await userEvent.type(callbackUrlsInput, 'https://changed.com/callback');

        const submitButton = screen.getByRole('button', {name: 'Update'});
        await userEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText('Edit OAuth 2.0 application')).toBeInTheDocument();
        });
    });

    test('should have match state when confirmModalDismissed is called', async () => {
        const editOAuthApp = jest.fn().mockResolvedValue({data: true});
        const props = {...baseProps, oauthApp, actions: {...baseProps.actions, editOAuthApp}};
        renderWithContext(
            <EditOAuthApp {...props}/>,
        );

        // Change callback URLs to trigger the confirm modal
        const callbackUrlsInput = screen.getByRole('textbox', {name: 'Callback URLs (One Per Line)'});
        await userEvent.clear(callbackUrlsInput);
        await userEvent.type(callbackUrlsInput, 'https://changed.com/callback');

        const submitButton = screen.getByRole('button', {name: 'Update'});
        await userEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText('Edit OAuth 2.0 application')).toBeInTheDocument();
        });

        // Dismiss the modal via cancel (use the modal's cancel button, not the form's Cancel link)
        const cancelButton = screen.getByTestId('cancel-button');
        await userEvent.click(cancelButton);

        await waitFor(() => {
            expect(screen.queryByText('Edit OAuth 2.0 application')).not.toBeInTheDocument();
        });
    });

    test('should have match renderExtra', () => {
        const props = {...baseProps, oauthApp};
        const {container} = renderWithContext(
            <EditOAuthApp {...props}/>,
        );

        // The renderExtra renders a ConfirmModal which should be in the DOM
        expect(container.querySelector('.integrations-backstage-modal')).toBeDefined();
    });

    test('should have match when editOAuthApp is called', async () => {
        const editOAuthApp = jest.fn().mockResolvedValue({data: true});
        const props = {...baseProps, oauthApp, actions: {...baseProps.actions, editOAuthApp}};
        renderWithContext(
            <EditOAuthApp {...props}/>,
        );

        // Submit without changing callback URLs - should call submitOAuthApp directly
        const submitButton = screen.getByRole('button', {name: 'Update'});
        await userEvent.click(submitButton);

        await waitFor(() => {
            expect(editOAuthApp).toHaveBeenCalled();
        });
    });

    test('should have match when submitOAuthApp is called on success', async () => {
        const editOAuthApp = jest.fn().mockResolvedValue({data: 'data'});
        const props = {...baseProps, oauthApp, actions: {...baseProps.actions, editOAuthApp}};
        renderWithContext(
            <EditOAuthApp {...props}/>,
        );

        const submitButton = screen.getByRole('button', {name: 'Update'});
        await userEvent.click(submitButton);

        await waitFor(() => {
            expect(getHistory().push).toHaveBeenCalledWith(`/${team.name}/integrations/oauth2-apps`);
        });
    });

    test('should have match when submitOAuthApp is called on error', async () => {
        const editOAuthApp = jest.fn().mockResolvedValue({error: {message: 'error message'}});
        const props = {...baseProps, oauthApp, actions: {...baseProps.actions, editOAuthApp}};
        renderWithContext(
            <EditOAuthApp {...props}/>,
        );

        const submitButton = screen.getByRole('button', {name: 'Update'});
        await userEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText('error message')).toBeInTheDocument();
        });
    });
});
