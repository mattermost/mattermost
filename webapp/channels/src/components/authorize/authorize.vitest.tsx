// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, act, waitFor, screen} from 'tests/vitest_react_testing_utils';

import Authorize from './authorize';

describe('components/user_settings/display/UserSettingsDisplay', () => {
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

    const requiredProps = {
        location: {search: ''},
        actions: {
            getOAuthAppInfo: vi.fn().mockResolvedValue({data: true}),
            allowOAuth2: vi.fn().mockResolvedValue({data: true}),
        },
    };

    test('UNSAFE_componentWillMount() should have called getOAuthAppInfo', async () => {
        const props = {...requiredProps, location: {search: 'client_id=1234abcd'}};

        await act(async () => {
            renderWithContext(<Authorize {...props}/>);
        });

        expect(requiredProps.actions.getOAuthAppInfo).toHaveBeenCalled();
        expect(requiredProps.actions.getOAuthAppInfo).toHaveBeenCalledWith('1234abcd');
    });

    test('UNSAFE_componentWillMount() should have updated state.app', async () => {
        const expected = oauthApp;
        const promise = Promise.resolve({data: expected});
        const actions = {...requiredProps.actions, getOAuthAppInfo: () => promise};
        const props = {...requiredProps, actions, location: {search: 'client_id=1234abcd'}};

        await act(async () => {
            renderWithContext(<Authorize {...props}/>);
            await promise;
        });

        // Wait for the app name to appear in the document, which confirms state was updated
        await waitFor(() => {
            const testAppElements = screen.getAllByText(/testApp/);
            expect(testAppElements.length).toBeGreaterThan(0);
        });
    });

    test('handleAllow() should have called allowOAuth2', async () => {
        const getOAuthAppInfo = vi.fn().mockResolvedValue({data: oauthApp});
        const allowOAuth2 = vi.fn().mockResolvedValue({data: true});
        const props = {
            location: {search: 'client_id=1234abcd'},
            actions: {
                getOAuthAppInfo,
                allowOAuth2,
            },
        };

        await act(async () => {
            renderWithContext(<Authorize {...props}/>);
        });

        // Wait for the component to load
        await waitFor(() => {
            const testAppElements = screen.getAllByText(/testApp/);
            expect(testAppElements.length).toBeGreaterThan(0);
        });

        // Click the Allow button
        const allowButton = screen.getByText('Allow');
        await act(async () => {
            allowButton.click();
        });

        await waitFor(() => {
            const expected = {
                clientId: '1234abcd',
                codeChallenge: null,
                codeChallengeMethod: null,
                responseType: null,
                redirectUri: null,
                state: null,
                scope: null,
                resource: null,
            };
            expect(allowOAuth2).toHaveBeenCalled();
            expect(allowOAuth2).toHaveBeenCalledWith(expected);
        });
    });

    test('handleAllow() should include resource parameter when provided in URL', async () => {
        const getOAuthAppInfo = vi.fn().mockResolvedValue({data: oauthApp});
        const allowOAuth2 = vi.fn().mockResolvedValue({data: true});
        const props = {
            location: {search: 'client_id=1234abcd&resource=https://example.com/api'},
            actions: {
                getOAuthAppInfo,
                allowOAuth2,
            },
        };

        await act(async () => {
            renderWithContext(<Authorize {...props}/>);
        });

        // Wait for the component to load
        await waitFor(() => {
            const testAppElements = screen.getAllByText(/testApp/);
            expect(testAppElements.length).toBeGreaterThan(0);
        });

        // Click the Allow button
        const allowButton = screen.getByText('Allow');
        await act(async () => {
            allowButton.click();
        });

        await waitFor(() => {
            const expected = {
                clientId: '1234abcd',
                codeChallenge: null,
                codeChallengeMethod: null,
                responseType: null,
                redirectUri: null,
                state: null,
                scope: null,
                resource: 'https://example.com/api',
            };
            expect(allowOAuth2).toHaveBeenCalled();
            expect(allowOAuth2).toHaveBeenCalledWith(expected);
        });
    });

    test('handleAllow() should have updated state.error', async () => {
        const error = new Error('error');
        const getOAuthAppInfo = vi.fn().mockResolvedValue({data: oauthApp});
        const allowOAuth2 = vi.fn().mockResolvedValue({error});
        const props = {
            location: {search: 'client_id=1234abcd'},
            actions: {
                getOAuthAppInfo,
                allowOAuth2,
            },
        };

        await act(async () => {
            renderWithContext(<Authorize {...props}/>);
        });

        // Wait for the component to load
        await waitFor(() => {
            const testAppElements = screen.getAllByText(/testApp/);
            expect(testAppElements.length).toBeGreaterThan(0);
        });

        // Click the Allow button
        const allowButton = screen.getByText('Allow');
        await act(async () => {
            allowButton.click();
        });

        await waitFor(() => {
            // The error should appear in the document
            expect(screen.getByText(error.message)).toBeInTheDocument();
        });
    });
});
