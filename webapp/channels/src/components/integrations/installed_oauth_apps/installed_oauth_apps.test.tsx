// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import InstalledOAuthApps from 'components/integrations/installed_oauth_apps/installed_oauth_apps';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

jest.mock('components/integrations/delete_integration_link', () => {
    const React = require('react'); // eslint-disable-line @typescript-eslint/no-var-requires, global-require
    return {
        __esModule: true,
        default: (props: {onDelete: () => void}) => React.createElement('button', {onClick: props.onDelete}, 'Delete'),
    };
});

describe('components/integrations/InstalledOAuthApps', () => {
    const oauthApps = {
        facxd9wpzpbpfp8pad78xj75pr: {
            id: 'facxd9wpzpbpfp8pad78xj75pr',
            name: 'firstApp',
            client_secret: '88cxd9wpzpbpfp8pad78xj75pr',
            create_at: 1501365458934,
            creator_id: '88oybd1dwfdoxpkpw1h5kpbyco',
            description: 'testing',
            homepage: 'https://test.com',
            icon_url: 'https://test.com/icon',
            is_trusted: false,
            update_at: 1501365458934,
            callback_urls: ['https://test.com/callback'],
        },
        fzcxd9wpzpbpfp8pad78xj75pr: {
            id: 'fzcxd9wpzpbpfp8pad78xj75pr',
            name: 'secondApp',
            client_secret: 'decxd9wpzpbpfp8pad78xj75pr',
            create_at: 1501365459984,
            creator_id: '88oybd2dwfdoxpkpw1h5kpbyco',
            description: 'testing2',
            homepage: 'https://test2.com',
            icon_url: 'https://test2.com/icon',
            is_trusted: true,
            update_at: 1501365479988,
            callback_urls: ['https://test2.com/callback', 'https://test2.com/callback2'],
        },
    };

    const initialState = {
        entities: {
            general: {
                config: {},
            },
            users: {
                currentUserId: 'currentUserId',
                profiles: {},
            },
        },
    };

    const baseProps = {
        team: TestHelper.getTeamMock({
            name: 'test',
        }),
        oauthApps,
        canManageOauth: true,
        actions: {
            loadOAuthAppsAndProfiles: jest.fn().mockResolvedValue({}),
            regenOAuthAppSecret: jest.fn(),
            deleteOAuthApp: jest.fn(),
        },
        enableOAuthServiceProvider: true,
        appsOAuthAppIDs: [] as string[],
    };

    test('should match snapshot', async () => {
        const {container} = renderWithContext(
            <InstalledOAuthApps {...baseProps}/>,
            initialState,
        );

        // Wait for loading to complete
        await screen.findByText('firstApp');

        expect(container).toMatchSnapshot();

        // Both apps should be rendered
        expect(screen.getByText('firstApp')).toBeInTheDocument();
        expect(screen.getByText('secondApp')).toBeInTheDocument();

        // Should have add link and add text when canManageOauth is true
        expect(screen.getByText('Add OAuth 2.0 Application')).toBeInTheDocument();

        // Filter by typing in search input
        const searchInput = screen.getByPlaceholderText('Search OAuth 2.0 Applications');
        await userEvent.type(searchInput, 'first');
        expect(screen.getByText('firstApp')).toBeInTheDocument();
        expect(screen.queryByText('secondApp')).not.toBeInTheDocument();

        // Clear and type non-matching filter
        await userEvent.clear(searchInput);
        await userEvent.type(searchInput, 'ZZZ');
        expect(screen.queryByText('firstApp')).not.toBeInTheDocument();
        expect(screen.queryByText('secondApp')).not.toBeInTheDocument();

        // Clear filter to show all apps again
        await userEvent.clear(searchInput);
        expect(screen.getByText('firstApp')).toBeInTheDocument();
        expect(screen.getByText('secondApp')).toBeInTheDocument();

        // Re-render with canManageOauth=false, add link should not be present
        const {container: container2} = renderWithContext(
            <InstalledOAuthApps
                {...baseProps}
                canManageOauth={false}
            />,
            initialState,
        );

        await screen.findAllByText('firstApp');
        expect(container2.querySelector('#addOauthApp')).not.toBeInTheDocument();
    });

    test('should match snapshot for Apps', async () => {
        const props = {
            ...baseProps,
            appsOAuthAppIDs: ['fzcxd9wpzpbpfp8pad78xj75pr'],
        };

        const {container} = renderWithContext(
            <InstalledOAuthApps {...props}/>,
            initialState,
        );

        // Wait for loading to complete
        await screen.findByText('firstApp');

        expect(container).toMatchSnapshot();

        // The app managed by Apps Framework should show managed text
        expect(screen.getByText('Managed by Apps Framework')).toBeInTheDocument();
    });

    test('should props.deleteOAuthApp on deleteOAuthApp', async () => {
        const deleteOAuthApp = jest.fn();
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                deleteOAuthApp,
            },
        };

        renderWithContext(
            <InstalledOAuthApps {...props}/>,
            initialState,
        );

        // Wait for loading to complete
        await screen.findByText('firstApp');

        // Click the first Delete button (mocked DeleteIntegrationLink)
        const deleteButtons = screen.getAllByRole('button', {name: 'Delete'});
        await userEvent.click(deleteButtons[0]);

        expect(deleteOAuthApp).toHaveBeenCalled();
        expect(deleteOAuthApp).toHaveBeenCalledWith(oauthApps.facxd9wpzpbpfp8pad78xj75pr.id);
    });
});
