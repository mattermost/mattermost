// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render} from 'tests/vitest_react_testing_utils';

import {ShortcutKey, ShortcutKeyVariant} from './shortcut_key';

describe('components/ShortcutKey', () => {
    test('should match snapshot for regular key', () => {
        const {container} = render(<ShortcutKey>{'Shift'}</ShortcutKey>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for contrast key', () => {
        const {container} = render(<ShortcutKey variant={ShortcutKeyVariant.Contrast}>{'Shift'}</ShortcutKey>);
        expect(container).toMatchSnapshot();
    });
});
