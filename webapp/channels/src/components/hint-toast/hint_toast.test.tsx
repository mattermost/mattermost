// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen, userEvent} from 'tests/react_testing_utils';

import {HintToast} from './hint_toast';

describe('components/HintToast', () => {
    test('should fire onDismiss callback', async () => {
        const dismissHandler = jest.fn();
        render(
            <HintToast
                onDismiss={dismissHandler}
            >{'A hint'}</HintToast>,
        );

        await userEvent.click(screen.getByTestId('dismissHintToast'));

        expect(dismissHandler).toHaveBeenCalled();
    });
});
