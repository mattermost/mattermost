// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, render} from '@testing-library/react';
import type {ComponentProps} from 'react';
import React from 'react';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

import PluginAction from './plugin_action';

type Props = ComponentProps<typeof PluginAction>;

function getBaseProps(): Props {
    return {
        action: {
            title: 'some title',
            text: 'some text',
            buttonText: 'button text',
            onClick: vi.fn(),
        },
    };
}

describe('PluginAction', () => {
    test('does not show when no action is provided', () => {
        const {container} = render(<PluginAction/>);
        expect(container.firstChild).toBeNull();
    });

    test('does show the correct information', () => {
        const props = getBaseProps();
        renderWithContext(<PluginAction {...props}/>);
        const button = screen.getByText(props.action!.buttonText);
        expect(button).toBeInTheDocument();
        expect(screen.queryByText(props.action!.text)).toBeInTheDocument();
        expect(screen.queryByText(props.action!.title)).toBeInTheDocument();
        fireEvent.click(button);
        expect(props.action?.onClick).toHaveBeenCalled();
    });
});
