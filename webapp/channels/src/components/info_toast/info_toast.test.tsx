// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {CheckIcon} from '@mattermost/compass-icons/components';

import {render, screen, userEvent} from 'tests/react_testing_utils';

import InfoToast from './info_toast';

describe('components/InfoToast', () => {
    const baseProps: ComponentProps<typeof InfoToast> = {
        content: {
            icon: <CheckIcon/>,
            message: 'test',
            undo: jest.fn(),
        },
        className: 'className',
        onExited: jest.fn(),
    };

    test('should match snapshot', () => {
        const {container} = render(<InfoToast {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should close the toast on undo', async () => {
        render(<InfoToast {...baseProps}/>);

        await userEvent.click(screen.getByText(/undo/i));
        expect(baseProps.content.undo).toHaveBeenCalled();
        expect(baseProps.onExited).toHaveBeenCalled();
    });

    test('should close the toast on close button click', async () => {
        render(<InfoToast {...baseProps}/>);

        await userEvent.click(screen.getByRole('button', {name: /close/i}));
        expect(baseProps.onExited).toHaveBeenCalled();
    });
});
