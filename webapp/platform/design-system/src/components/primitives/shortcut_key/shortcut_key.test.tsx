// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render} from '@testing-library/react';
import React from 'react';

import {ShortcutKey, ShortcutKeyVariant} from './shortcut_key';

describe('components/ShortcutKey', () => {
    test('should render regular key', () => {
        const {container} = render(<ShortcutKey>{'Shift'}</ShortcutKey>);
        expect(container.firstChild).toHaveClass('shortcut-key');
        expect(container.textContent).toBe('Shift');
    });

    test('should render contrast key', () => {
        const {container} = render(<ShortcutKey variant={ShortcutKeyVariant.Contrast}>{'Shift'}</ShortcutKey>);
        expect(container.firstChild).toHaveClass('shortcut-key');
        expect(container.firstChild).toHaveClass('shortcut-key--contrast');
        expect(container.textContent).toBe('Shift');
    });
});
