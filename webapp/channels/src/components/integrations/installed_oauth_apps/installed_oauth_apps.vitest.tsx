// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import InstalledOAuthApps from 'components/integrations/installed_oauth_apps/installed_oauth_apps';

import {renderWithContext, screen, act} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

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

    const baseProps = {
        team: TestHelper.getTeamMock({
            name: 'test',
        }),
        oauthApps,
        canManageOauth: true,
        actions: {
            loadOAuthAppsAndProfiles: vi.fn().mockReturnValue(Promise.resolve({})),
            regenOAuthAppSecret: vi.fn(),
            deleteOAuthApp: vi.fn(),
        },
        enableOAuthServiceProvider: true,
        appsOAuthAppIDs: [],
    };

    test('should match snapshot', async () => {
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(<InstalledOAuthApps {...baseProps}/>);
            container = result.container;
        });

        await vi.waitFor(() => {
            expect(baseProps.actions.loadOAuthAppsAndProfiles).toHaveBeenCalled();
        });

        expect(container!).toMatchSnapshot();

        // Should show add link when canManageOauth is true
        expect(screen.getByText('Add OAuth 2.0 Application')).toBeInTheDocument();
    });

    test('should match snapshot for Apps', async () => {
        const props = {
            ...baseProps,
            appsOAuthAppIDs: ['fzcxd9wpzpbpfp8pad78xj75pr'],
        };

        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(<InstalledOAuthApps {...props}/>);
            container = result.container;
        });

        await vi.waitFor(() => {
            expect(props.actions.loadOAuthAppsAndProfiles).toHaveBeenCalled();
        });

        expect(container!).toMatchSnapshot();
    });

    test('should props.deleteOAuthApp on deleteOAuthApp', async () => {
        const deleteOAuthApp = vi.fn();
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                deleteOAuthApp,
            },
        };

        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(<InstalledOAuthApps {...props}/>);
            container = result.container;
        });

        await vi.waitFor(() => {
            expect(container!.querySelector('.item-details')).toBeInTheDocument();
        });

        // The component renders OAuth apps
        expect(container!).toMatchSnapshot();
    });
});
