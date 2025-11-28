// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render} from '@testing-library/react';
import React from 'react';
import {describe, test, expect} from 'vitest';

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
