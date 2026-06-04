// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, renderHook} from 'tests/react_testing_utils';

import {useAppBodyClass, WithUserTheme} from './theme_context';

describe('useAppBodyClass', () => {
    afterEach(() => {
        document.body.classList.remove('app__body');
    });

    it('adds app__body to the document body for a themed route while mounted', () => {
        const {unmount} = renderHook(() => useAppBodyClass('/myteam/channels/town-square'));

        expect(document.body.classList.contains('app__body')).toBe(true);

        unmount();

        expect(document.body.classList.contains('app__body')).toBe(false);
    });

    it('does not add app__body on a backstage route', () => {
        renderHook(() => useAppBodyClass('/myteam/integrations/bots'));

        expect(document.body.classList.contains('app__body')).toBe(false);
    });

    it('toggles app__body as the route changes', () => {
        const {rerender} = renderHook(({pathname}) => useAppBodyClass(pathname), {initialProps: {pathname: '/myteam/channels/town-square'}});

        expect(document.body.classList.contains('app__body')).toBe(true);

        rerender({pathname: '/myteam/integrations'});
        expect(document.body.classList.contains('app__body')).toBe(false);

        rerender({pathname: '/myteam/channels/town-square'});
        expect(document.body.classList.contains('app__body')).toBe(true);
    });
});

describe('WithUserTheme', () => {
    afterEach(() => {
        document.body.classList.remove('app__body');
    });

    it('adds app__body to the document body for a themed route while mounted', () => {
        const {unmount} = render(
            <WithUserTheme pathname={'/myteam/channels/town-square'}>
                <div>{'Themed content'}</div>
            </WithUserTheme>,
        );

        expect(document.body.classList.contains('app__body')).toBe(true);

        unmount();

        expect(document.body.classList.contains('app__body')).toBe(false);
    });

    it('does not add app__body on a backstage route', () => {
        render(
            <WithUserTheme pathname={'/myteam/integrations'}>
                <div>{'Themed content'}</div>
            </WithUserTheme>,
        );

        expect(document.body.classList.contains('app__body')).toBe(false);
    });
});
