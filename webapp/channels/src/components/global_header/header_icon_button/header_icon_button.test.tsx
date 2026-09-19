// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen, userEvent} from 'tests/react_testing_utils';

import HeaderIconButton from './header_icon_button';

// `disabled` is only valid on form controls, so these render as a real <button>. The props type is
// what stops `disabled` being accepted on something else, so `tsc` is the guard for that half.
describe('components/global_header/HeaderIconButton', () => {
    test('should ignore clicks while disabled', async () => {
        const onClick = jest.fn();

        render(
            <HeaderIconButton
                icon='arrow-left'
                aria-label='Back'
                disabled={true}
                onClick={onClick}
            />,
        );

        const button = screen.getByRole('button', {name: 'Back'});
        expect(button).toBeDisabled();

        await userEvent.click(button);

        expect(onClick).not.toHaveBeenCalled();
    });

    test('should handle clicks while enabled', async () => {
        const onClick = jest.fn();

        render(
            <HeaderIconButton
                icon='arrow-left'
                aria-label='Back'
                disabled={false}
                onClick={onClick}
            />,
        );

        const button = screen.getByRole('button', {name: 'Back'});
        expect(button).toBeEnabled();

        await userEvent.click(button);

        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
