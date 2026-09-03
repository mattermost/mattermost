// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import Radio from './radio';

type Props = ComponentProps<typeof Radio>;

const OPTION_0_TEXT = 'Option 0';
const OPTION_1_TEXT = 'Option 1';

function getBaseProps(): Props {
    return {
        value: '0',
        onChange: jest.fn(),
        setting: {
            default: '0',
            options: [
                {text: OPTION_0_TEXT, value: '0', helpText: 'Help text 0'},
                {text: OPTION_1_TEXT, value: '1', helpText: 'Help text 1'},
            ],
            name: 'setting_name',
            type: 'radio',
            helpText: 'Some help text',
            title: 'Some title',
        },
    };
}

describe('radio', () => {
    it('all texts are displayed', () => {
        const props = getBaseProps();
        renderWithContext(<Radio {...props}/>);

        expect(screen.queryByText(props.setting.helpText!)).toBeInTheDocument();
        expect(screen.queryByText(props.setting.title!)).toBeInTheDocument();
    });

    it('reflects the controlled value', () => {
        const props = getBaseProps();
        props.value = '1';
        renderWithContext(<Radio {...props}/>);

        const option0Radio = screen.getByText(OPTION_0_TEXT).children[0] as HTMLInputElement;
        const option1Radio = screen.getByText(OPTION_1_TEXT).children[0] as HTMLInputElement;
        expect(option0Radio.checked).toBeFalsy();
        expect(option1Radio.checked).toBeTruthy();
    });

    it('calls onChange with the new value', async () => {
        const props = getBaseProps();
        renderWithContext(<Radio {...props}/>);

        await userEvent.click(screen.getByText(OPTION_1_TEXT));

        expect(props.onChange).toHaveBeenCalledWith('1');
    });
});
