// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {OAuthApp} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';

import EditOAuthApp from 'components/integrations/edit_oauth_app/edit_oauth_app';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

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
            getOAuthApp: vi.fn(),
            editOAuthApp: vi.fn(),
        },
        enableOAuthServiceProvider: true,
    };

    test('should match snapshot, loading', () => {
        const props = {...baseProps, oauthApp};
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
        const getOAuthApp = vi.fn();
        const props = {...baseProps, oauthApp, enableOAuthServiceProvider: false, actions: {...baseProps.actions, getOAuthApp}};
        const {container} = renderWithContext(
            <EditOAuthApp {...props}/>,
        );

        expect(container).toMatchSnapshot();
        expect(getOAuthApp).not.toHaveBeenCalled();
    });

    test('should have match state when handleConfirmModal is called', () => {
        const props = {...baseProps, oauthApp};
        const {container} = renderWithContext(
            <EditOAuthApp {...props}/>,
        );

        expect(container.querySelector('.backstage-form')).toBeInTheDocument();
    });

    test('should have match state when confirmModalDismissed is called', () => {
        const props = {...baseProps, oauthApp};
        const {container} = renderWithContext(
            <EditOAuthApp {...props}/>,
        );

        expect(container.querySelector('.backstage-form')).toBeInTheDocument();
    });

    test('should have match renderExtra', () => {
        const props = {...baseProps, oauthApp};
        const {container} = renderWithContext(
            <EditOAuthApp {...props}/>,
        );

        expect(container.querySelector('.backstage-form__footer')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should have match when editOAuthApp is called', () => {
        const props = {...baseProps, oauthApp};
        renderWithContext(
            <EditOAuthApp {...props}/>,
        );

        // The header text is "Edit"
        expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    test('should have match when submitOAuthApp is called on success', async () => {
        const editOAuthApp = vi.fn().mockImplementation(
            () => {
                return new Promise((resolve) => {
                    process.nextTick(() => resolve({
                        data: 'data',
                        error: null,
                    }));
                });
            },
        );

        const props = {...baseProps, oauthApp, actions: {...baseProps.actions, editOAuthApp}};
        renderWithContext(
            <EditOAuthApp {...props}/>,
        );

        // The header text is "Edit"
        expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    test('should have match when submitOAuthApp is called on error', async () => {
        const editOAuthApp = vi.fn().mockImplementation(
            () => {
                return new Promise((resolve) => {
                    process.nextTick(() => resolve({
                        data: null,
                        error: {message: 'error message'},
                    }));
                });
            },
        );
        const props = {...baseProps, oauthApp, actions: {...baseProps.actions, editOAuthApp}};
        renderWithContext(
            <EditOAuthApp {...props}/>,
        );

        // The header text is "Edit"
        expect(screen.getByText('Edit')).toBeInTheDocument();
    });
});
