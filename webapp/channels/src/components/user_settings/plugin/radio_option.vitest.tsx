// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent} from '@testing-library/react';
import type {ComponentProps} from 'react';
import React from 'react';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

import RadioOption from './radio_option';

type Props = ComponentProps<typeof RadioOption>;

function getBaseProps(): Props {
    return {
        name: 'name',
        onSelected: vi.fn(),
        option: {
            text: 'text',
            value: 'value',
            helpText: 'help',
        },
        selectedValue: 'other',
    };
}

describe('radio option', () => {
    test('all text are properly rendered', () => {
        const props = getBaseProps();
        renderWithContext(<RadioOption {...props}/>);

        expect(screen.queryByText(props.option.text)).toBeInTheDocument();
        expect(screen.queryByText(props.option.helpText!)).toBeInTheDocument();
    });

    test('onSelected is properly called', () => {
        const props = getBaseProps();
        renderWithContext(<RadioOption {...props}/>);

        fireEvent.click(screen.getByText(props.option.text));

        expect(props.onSelected).toHaveBeenCalledWith(props.option.value);
    });
});
