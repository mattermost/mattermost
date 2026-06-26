// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';
import {Router} from 'react-router-dom';

import {act, render, renderHook} from 'tests/react_testing_utils';

import {useAppBodyClass, WithUserTheme} from './theme_context';

describe('useAppBodyClass', () => {
    afterEach(() => {
        document.body.classList.remove('app__body');
    });

    function renderUseAppBodyClass(pathname: string) {
        const history = createMemoryHistory({initialEntries: [pathname]});
        const view = renderHook(() => useAppBodyClass(), {
            wrapper: ({children}) => (
                <Router history={history}>
                    {children}
                </Router>
            ),
        });

        return {...view, history};
    }

    it.each([
        '/myteam/channels/town-square',
        '/myteam/messages/@someone',
        '/myteam/channels/integrations',
        '/admin_console/integrations/bot_accounts',
        '/create_team',
        '/select_team',
        '/plug/some-plugin',
        '/',
    ])('adds app__body to the document body for themed route %s while mounted', (pathname) => {
        const {unmount} = renderUseAppBodyClass(pathname);

        expect(document.body.classList.contains('app__body')).toBe(true);

        unmount();

        expect(document.body.classList.contains('app__body')).toBe(false);
    });

    it.each([
        '/myteam/integrations',
        '/myteam/integrations/',
        '/myteam/integrations/bots',
        '/myteam/integrations/incoming_webhooks',
        '/myteam/emoji',
        '/myteam/emoji/add',
        '/my-team_1/integrations',
    ])('does not add app__body on backstage route %s', (pathname) => {
        renderUseAppBodyClass(pathname);

        expect(document.body.classList.contains('app__body')).toBe(false);
    });

    it('toggles app__body as the route changes', () => {
        const {history} = renderUseAppBodyClass('/myteam/channels/town-square');

        expect(document.body.classList.contains('app__body')).toBe(true);

        act(() => {
            history.push('/myteam/integrations');
        });
        expect(document.body.classList.contains('app__body')).toBe(false);

        act(() => {
            history.push('/myteam/channels/town-square');
        });
        expect(document.body.classList.contains('app__body')).toBe(true);
    });
});

describe('WithUserTheme', () => {
    afterEach(() => {
        document.body.classList.remove('app__body');
    });

    function renderWithUserTheme(pathname: string) {
        const history = createMemoryHistory({initialEntries: [pathname]});

        return render(
            <Router history={history}>
                <WithUserTheme>
                    <div>{'Themed content'}</div>
                </WithUserTheme>
            </Router>,
        );
    }

    it('adds app__body to the document body for a themed route while mounted', () => {
        const {unmount} = renderWithUserTheme('/myteam/channels/town-square');

        expect(document.body.classList.contains('app__body')).toBe(true);

        unmount();

        expect(document.body.classList.contains('app__body')).toBe(false);
    });

    it('does not add app__body on a backstage route', () => {
        renderWithUserTheme('/myteam/integrations');

        expect(document.body.classList.contains('app__body')).toBe(false);
    });
});
