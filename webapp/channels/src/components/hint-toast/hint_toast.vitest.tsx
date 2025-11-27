// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, fireEvent} from '@testing-library/react';
import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import {HintToast} from './hint_toast';

describe('components/HintToast', () => {
    test('should match snapshot', () => {
        const {container} = render(
            <HintToast
                onDismiss={vi.fn()}
            >{'A hint'}</HintToast>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should fire onDismiss callback', () => {
        const dismissHandler = vi.fn();
        render(
            <HintToast
                onDismiss={dismissHandler}
            >{'A hint'}</HintToast>,
        );

        fireEvent.click(screen.getByTestId('dismissHintToast'));

        expect(dismissHandler).toHaveBeenCalled();
    });
});
