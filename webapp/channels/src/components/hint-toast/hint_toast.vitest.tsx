// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, fireEvent} from 'tests/vitest_react_testing_utils';

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
        const {container} = render(
            <HintToast
                onDismiss={dismissHandler}
            >{'A hint'}</HintToast>,
        );

        const dismissButton = container.querySelector('.hint-toast__dismiss');
        expect(dismissButton).toBeTruthy();
        fireEvent.click(dismissButton!);

        expect(dismissHandler).toHaveBeenCalled();
    });
});
