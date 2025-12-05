// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';

import {CheckIcon} from '@mattermost/compass-icons/components';

import {render, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import InfoToast from './info_toast';

describe('components/InfoToast', () => {
    const baseProps: ComponentProps<typeof InfoToast> = {
        content: {
            icon: <CheckIcon/>,
            message: 'test',
            undo: vi.fn(),
        },
        className: 'className',
        onExited: vi.fn(),
    };

    test('should match snapshot', () => {
        const {container} = render(<InfoToast {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should close the toast on undo', () => {
        render(<InfoToast {...baseProps}/>);

        fireEvent.click(screen.getByText(/undo/i));
        expect(baseProps.content.undo).toHaveBeenCalled();
        expect(baseProps.onExited).toHaveBeenCalled();
    });

    test('should close the toast on close button click', () => {
        render(<InfoToast {...baseProps}/>);

        fireEvent.click(screen.getByRole('button', {name: /close/i}));
        expect(baseProps.onExited).toHaveBeenCalled();
    });
});
