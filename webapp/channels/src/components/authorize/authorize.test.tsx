// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import Authorize from './authorize';

jest.mock('utils/browser_history', () => ({
    getHistory: jest.fn(() => ({replace: jest.fn(), push: jest.fn()})),
}));

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

    let requiredProps: {
        location: {search: string};
        actions: {
            getOAuthAppInfo: jest.Mock;
            allowOAuth2: jest.Mock;
        };
    };

    beforeEach(() => {
        jest.clearAllMocks();
        requiredProps = {
            location: {search: ''},
            actions: {
                getOAuthAppInfo: jest.fn().mockResolvedValue({data: oauthApp}),
                allowOAuth2: jest.fn().mockResolvedValue({data: true}),
            },
        };
    });

    test('UNSAFE_componentWillMount() should have called getOAuthAppInfo', () => {
        const props = {...requiredProps, location: {search: 'client_id=1234abcd'}};

        renderWithContext(<Authorize {...props}/>);

        expect(props.actions.getOAuthAppInfo).toHaveBeenCalled();
        expect(props.actions.getOAuthAppInfo).toHaveBeenCalledWith('1234abcd');
    });

    test('UNSAFE_componentWillMount() should have updated state.app', async () => {
        const props = {...requiredProps, location: {search: 'client_id=1234abcd'}};

        renderWithContext(<Authorize {...props}/>);

        await waitFor(() => {
            expect(screen.getByRole('button', {name: 'Allow'})).toBeInTheDocument();
        });
    });

    test('handleAllow() should have called allowOAuth2', async () => {
        const props = {...requiredProps, location: {search: 'client_id=1234abcd'}};

        renderWithContext(<Authorize {...props}/>);

        await waitFor(() => {
            expect(screen.getByRole('button', {name: 'Allow'})).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole('button', {name: 'Allow'}));

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
        expect(props.actions.allowOAuth2).toHaveBeenCalled();
        expect(props.actions.allowOAuth2).toHaveBeenCalledWith(expected);
    });

    test('handleAllow() should include resource parameter when provided in URL', async () => {
        const props = {...requiredProps, location: {search: 'client_id=1234abcd&resource=https://example.com/api'}};

        renderWithContext(<Authorize {...props}/>);

        await waitFor(() => {
            expect(screen.getByRole('button', {name: 'Allow'})).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole('button', {name: 'Allow'}));

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
        expect(props.actions.allowOAuth2).toHaveBeenCalled();
        expect(props.actions.allowOAuth2).toHaveBeenCalledWith(expected);
    });

    test('handleAllow() should have updated state.error', async () => {
        const error = new Error('error');
        const actions = {
            ...requiredProps.actions,
            allowOAuth2: jest.fn().mockResolvedValue({error}),
        };
        const props = {...requiredProps, actions, location: {search: 'client_id=1234abcd'}};

        renderWithContext(<Authorize {...props}/>);

        await waitFor(() => {
            expect(screen.getByRole('button', {name: 'Allow'})).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole('button', {name: 'Allow'}));

        await waitFor(() => {
            expect(screen.getByText('error')).toBeInTheDocument();
        });
    });
});
