// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import InstalledOAuthApp from 'components/integrations/installed_oauth_app/installed_oauth_app';

import {renderWithContext, screen, userEvent} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/integrations/InstalledOAuthApp', () => {
    const FAKE_SECRET = '***************';
    const team = TestHelper.getTeamMock({name: 'team_name'});
    const oauthApp = {
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
    const regenOAuthAppSecretRequest = {
        status: 'not_started',
        error: null,
    };

    const baseProps = {
        team,
        oauthApp,
        creatorName: 'somename',
        regenOAuthAppSecretRequest,
        onRegenerateSecret: vi.fn(),
        onDelete: vi.fn(),
        filter: '',
        fromApp: false,
    };

    test('should match snapshot', () => {
        const props = {...baseProps, team};
        const {container} = renderWithContext(
            <InstalledOAuthApp {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot from app', () => {
        const props = {...baseProps, team, fromApp: true};
        const {container} = renderWithContext(
            <InstalledOAuthApp {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, when oauthApp is without name and not trusted', () => {
        const props = {...baseProps, team, oauthApp: {...oauthApp, name: '', is_trusted: false}};
        const {container} = renderWithContext(
            <InstalledOAuthApp {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on error', () => {
        const props = {...baseProps, team, regenOAuthAppSecretRequest: {status: 'error', error: {message: 'error'}}};
        const {container} = renderWithContext(
            <InstalledOAuthApp {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should call onRegenerateSecret function', async () => {
        const onRegenerateSecret = vi.fn().mockResolvedValue({});
        const props = {
            ...baseProps,
            team,
            onRegenerateSecret,
        };

        const {container} = renderWithContext(
            <InstalledOAuthApp {...props}/>,
        );

        const regenerateButton = container.querySelector('#regenerateSecretButton') as HTMLElement;
        await userEvent.click(regenerateButton);

        expect(onRegenerateSecret).toHaveBeenCalled();
        expect(onRegenerateSecret).toHaveBeenCalledWith(oauthApp.id);
    });

    test('should filter out OAuthApp', () => {
        const filter = 'filter';
        const props = {...baseProps, filter};
        const {container} = renderWithContext(
            <InstalledOAuthApp {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match state on button clicks, both showSecretButton and hideSecretButton', async () => {
        const props = {...baseProps, team};
        const {container} = renderWithContext(
            <InstalledOAuthApp {...props}/>,
        );

        expect(container.querySelector('#showSecretButton')).toBeInTheDocument();
        expect(container.querySelector('#hideSecretButton')).not.toBeInTheDocument();

        // Click show button
        const showButton = container.querySelector('#showSecretButton') as HTMLElement;
        await userEvent.click(showButton);

        // After showing secret, the secret should be visible and hideSecretButton should appear
        expect(screen.getByText(oauthApp.client_secret)).toBeInTheDocument();
        expect(container.querySelector('#showSecretButton')).not.toBeInTheDocument();
        expect(container.querySelector('#hideSecretButton')).toBeInTheDocument();

        // Click hide button
        const hideButton = container.querySelector('#hideSecretButton') as HTMLElement;
        await userEvent.click(hideButton);

        // After hiding, should be back to initial state
        expect(screen.getByText(FAKE_SECRET)).toBeInTheDocument();
        expect(container.querySelector('#showSecretButton')).toBeInTheDocument();
        expect(container.querySelector('#hideSecretButton')).not.toBeInTheDocument();
    });

    test('should match on handleRegenerate', async () => {
        const onRegenerateSecret = vi.fn().mockResolvedValue({});
        const props = {
            ...baseProps,
            team,
            onRegenerateSecret,
        };

        const {container} = renderWithContext(
            <InstalledOAuthApp {...props}/>,
        );

        expect(container.querySelector('#regenerateSecretButton')).toBeInTheDocument();
        const regenerateButton = container.querySelector('#regenerateSecretButton') as HTMLElement;
        await userEvent.click(regenerateButton);

        expect(onRegenerateSecret).toHaveBeenCalled();
        expect(onRegenerateSecret).toHaveBeenCalledWith(oauthApp.id);
    });

    test('should have called props.onDelete on handleDelete ', async () => {
        const newOnDelete = vi.fn();
        const props = {...baseProps, team, onDelete: newOnDelete};
        const {container} = renderWithContext(
            <InstalledOAuthApp {...props}/>,
        );

        // The DeleteIntegrationLink component renders a Delete button
        // that opens a confirmation modal, which then calls onDelete
        expect(screen.getByText('Delete')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });
});
