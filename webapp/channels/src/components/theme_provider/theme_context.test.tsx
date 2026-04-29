// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, renderHook} from 'tests/react_testing_utils';

import {useAppBodyClass, WithUserTheme} from './theme_context';

describe('useAppBodyClass', () => {
    afterEach(() => {
        document.body.classList.remove('app__body');
    });

    it('adds app__body to the document body while mounted', () => {
        const {unmount} = renderHook(() => useAppBodyClass());

        expect(document.body.classList.contains('app__body')).toBe(true);

        unmount();

        expect(document.body.classList.contains('app__body')).toBe(false);
    });
});

describe('WithUserTheme', () => {
    afterEach(() => {
        document.body.classList.remove('app__body');
    });

    it('adds app__body to the document body while mounted', () => {
        const {unmount} = render(
            <WithUserTheme>
                <div>{'Themed content'}</div>
            </WithUserTheme>,
        );

        expect(document.body.classList.contains('app__body')).toBe(true);

        unmount();

        expect(document.body.classList.contains('app__body')).toBe(false);
    });
});
