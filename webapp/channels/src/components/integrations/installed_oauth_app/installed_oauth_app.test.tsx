// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import InstalledOAuthApp from 'components/integrations/installed_oauth_app/installed_oauth_app';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

jest.mock('components/integrations/delete_integration_link', () => {
    return {
        __esModule: true,
        default: (props: {onDelete: () => void}) => (
            <button onClick={props.onDelete}>{'Delete'}</button>
        ),
    };
});

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
        onRegenerateSecret: jest.fn(),
        onDelete: jest.fn(),
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
        const props = {
            ...baseProps,
            team,
            oauthApp: {
                ...oauthApp,
                name: '',
                is_trusted: false,
            },
        };
        const {container} = renderWithContext(
            <InstalledOAuthApp {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on error', () => {
        const onRegenerateSecret = jest.fn().mockResolvedValue({error: {message: 'error'}});
        const props = {...baseProps, team, onRegenerateSecret};
        const {container} = renderWithContext(
            <InstalledOAuthApp {...props}/>,
        );

        // Trigger error by clicking regenerate
        screen.getByText('Regenerate Secret').click();

        waitFor(() => {
            expect(container).toMatchSnapshot();
        });
    });

    test('should call onRegenerateSecret function', async () => {
        const onRegenerateSecret = jest.fn().mockResolvedValue({});
        const props = {
            ...baseProps,
            team,
            onRegenerateSecret,
        };

        renderWithContext(
            <InstalledOAuthApp {...props}/>,
        );

        await userEvent.click(screen.getByText('Regenerate Secret'));

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
        renderWithContext(
            <InstalledOAuthApp {...props}/>,
        );

        // Initially show secret button is visible, hide secret button is not
        expect(screen.getByText('Show Secret')).toBeInTheDocument();
        expect(screen.queryByText('Hide Secret')).not.toBeInTheDocument();
        expect(screen.getByText(FAKE_SECRET)).toBeInTheDocument();

        // Click show secret
        await userEvent.click(screen.getByText('Show Secret'));
        expect(screen.getByText(oauthApp.client_secret)).toBeInTheDocument();
        expect(screen.queryByText('Show Secret')).not.toBeInTheDocument();
        expect(screen.getByText('Hide Secret')).toBeInTheDocument();

        // Click hide secret
        await userEvent.click(screen.getByText('Hide Secret'));
        expect(screen.getByText(FAKE_SECRET)).toBeInTheDocument();
        expect(screen.getByText('Show Secret')).toBeInTheDocument();
        expect(screen.queryByText('Hide Secret')).not.toBeInTheDocument();
    });

    test('should match on handleRegenerate', async () => {
        const onRegenerateSecret = jest.fn().mockResolvedValue({});
        const props = {
            ...baseProps,
            team,
            onRegenerateSecret,
        };

        renderWithContext(
            <InstalledOAuthApp {...props}/>,
        );

        expect(screen.getByText('Regenerate Secret')).toBeInTheDocument();
        await userEvent.click(screen.getByText('Regenerate Secret'));
        expect(onRegenerateSecret).toHaveBeenCalled();
        expect(onRegenerateSecret).toHaveBeenCalledWith(oauthApp.id);
    });

    test('should have called props.onDelete on handleDelete ', async () => {
        const newOnDelete = jest.fn();
        const props = {...baseProps, team, onDelete: newOnDelete};
        renderWithContext(
            <InstalledOAuthApp {...props}/>,
        );

        expect(screen.getByText('Delete')).toBeInTheDocument();
        await userEvent.click(screen.getByText('Delete'));

        expect(newOnDelete).toHaveBeenCalled();
        expect(newOnDelete).toHaveBeenCalledWith(oauthApp);
    });
});
